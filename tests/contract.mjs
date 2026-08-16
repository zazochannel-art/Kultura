// Contract tests against the REAL backend.
//
// Why this file exists: the smoke suite is hermetic — it cuts every request to
// Supabase and answers with fixtures. That makes it fast and stable, and it is
// the right default. But it validates a world we invented, and four defects
// shipped in a row because the invented world disagreed with production:
//
//   * the bot token was saved into `app_config`, which the browser cannot write
//   * the same panel read it back, which the browser cannot read either
//   * `prune_deleted_cars()` was left executable by `anon`
//   * a whole feature shipped with no reachable entry point
//
// A mock can never catch any of those: it does not know about grants, RLS, or
// what an edge function really returns. These checks do.
//
// SAFETY — this runs against production, so every assertion here is one of:
//   * a read that is public by design, or
//   * an operation that MUST be refused (we assert the refusal).
// Nothing in this file may create, modify or delete a row. Do not add a check
// that writes; add it to the smoke suite against a fixture instead.
//
// The anon key is public by design (it ships in the HTML), so no CI secret is
// needed and this runs on every pull request.
import { readFileSync } from 'node:fs';

const SUPA = 'https://knphmxxokowwkruimdus.supabase.co';

// Read the key out of the shipped page rather than duplicating it, so rotating
// it in one place cannot leave this file testing a dead key.
const KEY = (() => {
  const html = readFileSync(new URL('../register.html', import.meta.url), 'utf8');
  const m = html.match(/const SUPA_ANON = '([^']+)'/);
  if (!m) throw new Error('anon key not found in register.html');
  return m[1];
})();

const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`);
};

const anonHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(path, init = {}) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { ...anonHeaders, ...(init.headers || {}) } });
  let body = null;
  try { body = await res.json(); } catch { /* some errors have no body */ }
  return { status: res.status, body };
}

async function fn(name, init = {}) {
  const res = await fetch(`${SUPA}/functions/v1/${name}`, { ...init, headers: { ...anonHeaders, ...(init.headers || {}) } });
  let body = null;
  try { body = await res.json(); } catch { /* ditto */ }
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------

async function main() {
  // Prove we are actually talking to Supabase before asserting anything.
  //
  // This guard is the point of the whole file. A blocking proxy answers 403 to
  // everything, and Node surfaces that as an ordinary response rather than a
  // throw — so every "must be refused" check below would pass for the wrong
  // reason. The first run of this suite did exactly that: 27 green checks
  // against a network that was never reached. So: demand a known-good public
  // answer, and refuse to report anything if we do not get one.
  {
    let ok = false, why = '';
    try {
      const res = await fetch(`${SUPA}/functions/v1/event-info`,
        { headers: anonHeaders, signal: AbortSignal.timeout(20000) });
      const body = await res.json().catch(() => null);
      ok = res.status === 200 && body && typeof body === 'object' && 'agenda' in body;
      why = `status ${res.status}, keys ${body && typeof body === 'object' ? Object.keys(body).join(',') : '—'}`;
    } catch (e) {
      why = e.message;
    }
    if (!ok) {
      const msg = `did not reach Supabase (${why})`;
      if (process.env.CONTRACT_REQUIRE === '1') {
        console.error(`\nContract tests could not run: ${msg}`);
        process.exit(1);
      }
      console.log(`SKIP  contract tests — ${msg}`);
      process.exit(0);
    }
  }

  // --- Secrets stay server-side -------------------------------------------
  // RLS is on with no policies, so PostgREST answers 200 with an empty list
  // rather than an error. That silence is exactly what fooled the Telegram
  // panel: the code "worked" and wrote nothing.
  {
    const r = await rest('app_config?select=key,value');
    check('anon-cannot-read-app_config',
      r.status !== 200 || (Array.isArray(r.body) && r.body.length === 0),
      `status ${r.status}, ${Array.isArray(r.body) ? r.body.length : '?'} rows`);

    const w = await rest('app_config', {
      method: 'POST', body: JSON.stringify({ key: 'contract_probe', value: 'x' }),
    });
    check('anon-cannot-write-app_config', w.status >= 400, `status ${w.status}`);
  }

  // --- Function grants -----------------------------------------------------
  // Postgres grants EXECUTE to `public` by default, so every new function is
  // reachable at /rest/v1/rpc/<name> until someone revokes it. `prune_deleted_cars`
  // shipped that way and could empty the recycle bin for anyone with the key.
  for (const name of ['prune_deleted_cars', 'prune_activity_log', 'prune_rate_limits',
    'prune_client_errors', 'assign_entry_no', 'guard_frozen_entry_no',
    'restore_car_unchecked', 'run_backup', 'resync_sequences']) {
    const r = await rest(`rpc/${name}`, { method: 'POST', body: '{}' });
    check(`anon-cannot-execute-${name}`, r.status >= 400, `status ${r.status}`);
  }

  // The mirror image: the RLS helpers MUST stay callable, or every protected
  // query breaks. This has been broken once before by "tidying up" the advisor
  // warnings, so it is pinned here.
  for (const name of ['is_staff_or_admin', 'is_team_member', 'is_admin_user', 'current_email']) {
    const r = await rest(`rpc/${name}`, { method: 'POST', body: '{}' });
    check(`rls-helper-${name}-still-callable`, r.status === 200, `status ${r.status}`);
  }

  // --- Public write paths --------------------------------------------------
  // Direct inserts were removed on purpose; everything public goes through
  // `submit`, which applies the honeypot and the atomic rate limit.
  for (const table of ['car_registrations', 'event_feedback', 'cars', 'car_votes']) {
    const r = await rest(table, { method: 'POST', body: JSON.stringify({}) });
    check(`anon-cannot-insert-${table}`, r.status >= 400, `status ${r.status}`);
  }

  // Participant data must not be readable without signing in.
  for (const table of ['cars', 'car_registrations', 'profiles', 'activity_log']) {
    const r = await rest(`${table}?select=id&limit=1`);
    check(`anon-cannot-read-${table}`,
      r.status !== 200 || (Array.isArray(r.body) && r.body.length === 0),
      `status ${r.status}, ${Array.isArray(r.body) ? r.body.length : '?'} rows`);
  }

  // --- Edge functions: the shapes the public pages depend on ---------------
  {
    const r = await fn('event-info');
    const ev = r.body && r.body.event;
    check('event-info-answers', r.status === 200 && !!r.body, `status ${r.status}`);
    check('event-info-has-event-shape',
      !ev || (typeof ev === 'object' && 'title' in ev && 'spots_left' in ev),
      ev ? Object.keys(ev).join(',') : 'no event');
  }

  {
    // Deliberately a plate nobody has: the answer must be a verdict, never data.
    const r = await fn('plate-check', { method: 'POST', body: JSON.stringify({ plate: 'ZZ CONTRACT 000' }) });
    check('plate-check-answers', r.status === 200 && r.body && 'known' in r.body, `status ${r.status}`);
    check('plate-check-leaks-nothing',
      !r.body || Object.keys(r.body).every(k => ['known', 'pending', 'blocked'].includes(k)),
      r.body ? Object.keys(r.body).join(',') : '');
  }

  // A real car id matters here: against a nonexistent one both endpoints answer
  // "not found", which would pass even if the key check were deleted. Voting is
  // the only public place that exposes ids, so borrow one when it is open.
  let realCarId = null;
  {
    const r = await fn('vote');
    check('vote-answers-open-flag', r.status === 200 && r.body && 'open' in r.body, `status ${r.status}`);
    if (r.body?.open && Array.isArray(r.body.cars) && r.body.cars.length) realCarId = r.body.cars[0].id;
    // The public leaderboard must not carry contact details.
    const leaked = (r.body?.cars || []).flatMap(c => Object.keys(c))
      .filter(k => ['phone', 'email', 'telegram', 'contact', 'telegram_chat_id'].includes(k));
    check('vote-list-has-no-contact-details', leaked.length === 0, [...new Set(leaked)].join(','));
  }

  {
    const id = realCarId ?? 1;
    const r = await fn(`ticket?c=${id}&k=definitely-not-the-plate`);
    // 403 = the plate guard bit. 404 only happens when we had no real id.
    check('ticket-refuses-wrong-key',
      realCarId ? r.status === 403 : (r.status === 403 || r.status === 404),
      `status ${r.status}${realCarId ? '' : ' (no real id available)'}`);
  }

  {
    const id = realCarId ?? 1;
    const r = await fn(`rsvp?c=${id}&t=${'0'.repeat(24)}`);
    check('rsvp-refuses-forged-token',
      realCarId ? r.status === 403 : (r.status === 403 || r.status === 404),
      `status ${r.status}${realCarId ? '' : ' (no real id available)'}`);
  }

  // --- Edge functions: the doors that must stay shut -----------------------
  {
    // Telegram's webhook is guarded by a shared secret header, not a JWT.
    const r = await fn('telegram', {
      method: 'POST',
      body: JSON.stringify({ message: { chat: { id: 1 }, text: '/start' } }),
    });
    check('telegram-webhook-needs-secret', r.status === 403, `status ${r.status}`);

    // Setup is admin-only; the anon key is not an admin.
    const s = await fn('telegram', { method: 'POST', body: JSON.stringify({ action: 'setup' }) });
    check('telegram-setup-needs-admin', s.status === 401, `status ${s.status}`);

    // Invite links are how participants get connected; staff-only.
    const i = await fn('telegram', { method: 'POST', body: JSON.stringify({ action: 'invite' }) });
    check('telegram-invite-needs-staff', i.status === 401, `status ${i.status}`);
  }

  for (const [name, payload] of [
    ['import-participants', { rows: [] }],
    ['send-sms', { message: 'x', recipients: [] }],
    ['backup', {}],
  ]) {
    const r = await fn(name, { method: 'POST', body: JSON.stringify(payload) });
    check(`${name}-needs-authorization`, r.status === 401 || r.status === 403, `status ${r.status}`);
  }

  {
    // Rejected before any rate-limit slot is consumed, so this is safe to run
    // on every pull request.
    const r = await fn('submit', { method: 'POST', body: JSON.stringify({ kind: 'nonsense' }) });
    check('submit-rejects-unknown-kind', r.status === 400, `status ${r.status}`);
  }

  // ---------------------------------------------------------------------------
  const failed = checks.filter(c => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error('contract tests crashed:', e);
  process.exit(1);
});
