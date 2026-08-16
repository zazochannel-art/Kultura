/**
 * Kultura — smoke tests (Playwright).
 *
 * Boots the static dev server, loads the app in headless Chromium and checks
 * the key surfaces render with zero JS errors, plus a couple of offline flows.
 *
 * Run:  node tests/smoke.mjs
 * Needs Playwright + a Chromium. Set PLAYWRIGHT_CHROMIUM to override the binary
 * (defaults to /opt/pw-browsers/chromium, then Playwright's bundled build).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8199;
const BASE = `http://localhost:${PORT}`;

const checks = [];
const check = (name, cond) => { checks.push({ name, ok: !!cond }); };

function startServer() {
  const srv = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, PORT }, stdio: 'ignore' });
  return srv;
}
async function waitForServer(timeoutMs = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const r = await fetch(BASE + '/index.html'); if (r.ok) return; } catch (_) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('dev server did not start');
}

function chromiumOpts() {
  const cand = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return existsSync(cand) ? { executablePath: cand } : {};
}

const srv = startServer();
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(chromiumOpts());
  const ctx = await browser.newContext();
  // Keep the run hermetic: cut every call to the live backend. Without this the
  // result depends on whether the runner can reach Supabase — locally it can't
  // (so cached fixtures survive), in CI it can (so a real empty fetch wipes
  // them). Same behaviour everywhere, and no test traffic against production.
  await ctx.route('**://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  const requestedUrls = [];
  page.on('request', r => requestedUrls.push(r.url()));

  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  // 1. Core surfaces present
  const els = await page.evaluate(() => ({
    login: !!document.getElementById('loginView'),
    gate: !!document.getElementById('gateOverlay'),
    kanbanToggle: !!document.getElementById('tasksViewToggle'),
    connBanner: !!document.getElementById('connBanner'),
    qrModal: !!document.getElementById('modal-car-qr'),
    zoneCfg: !!document.getElementById('zoneCfgBlock'),
    whatsNew: !!document.getElementById('modal-whatsnew'),
    tasksViewChips: !!document.getElementById('tasksViewChips'),
    carTelegram: !!document.querySelector('#form-add-car [name="telegram"]'),
    taskDonut: !!document.getElementById('taskDonutFill'),
    heroCover: !!document.getElementById('heroCover'),
    eventCover: !!document.getElementById('eventCoverInput'),
    heroCountdown: !!document.getElementById('heroCountdown'),
    homeAnnounce: !!document.getElementById('homeAnnounce'),
    announceBlock: !!document.getElementById('announceBlock'),
    platB: !!document.getElementById('gatePlateBtn'),
    zoneBoard: !!document.getElementById('zoneBoard'),
    vipSection: !!document.getElementById('section-vip'),
    vipList: !!document.getElementById('vipList'),
    vipAddModal: !!document.getElementById('modal-add-vip'),
    vipStat: !!document.getElementById('vipStatTotal'),
    regQueue: !!document.getElementById('regQueue'),
    gateLogout: !!document.getElementById('gateLogoutBtn'),
    agendaBlock: !!document.getElementById('agendaBlock'),
    smsSection: !!document.getElementById('section-sms'),
    smsMessage: !!document.getElementById('smsMessage'),
    smsHistory: !!document.getElementById('smsHistoryBody'),
    // Surfaces added after the original smoke pass was written.
    cmdk: !!document.getElementById('cmdk'),
    cmdkInput: !!document.getElementById('cmdkInput'),
    gateKiosk: !!document.getElementById('gateKioskBtn'),
    gateLabel: !!document.getElementById('gateLabelBtn'),
    passSheet: !!document.getElementById('passSheet'),
    reportBtn: !!document.getElementById('reportBtn'),
    compareBlock: !!document.getElementById('compareBlock'),
    blocklistBlock: !!document.getElementById('blocklistBlock'),
    backupBlock: !!document.getElementById('backupBlock'),
    gdprBlock: !!document.getElementById('gdprBlock'),
    activityBlock: !!document.getElementById('activityBlock'),
    activityCsv: !!document.getElementById('activityCsvBtn'),
    votingBlock: !!document.getElementById('votingBlock'),
    feedbackBlock: !!document.getElementById('feedbackBlock'),
    afluxCounters: !!document.getElementById('afluxCounters'),
  }));
  Object.entries(els).forEach(([k, v]) => check('element:' + k, v));

  // 1b. Command palette opens on Ctrl-K and filters.
  await page.keyboard.press('Control+KeyK');
  const cmdkShown = await page.evaluate(() => document.getElementById('cmdk').classList.contains('show'));
  check('cmdk-opens', cmdkShown);
  await page.keyboard.press('Escape');
  const cmdkClosed = await page.evaluate(() => !document.getElementById('cmdk').classList.contains('show'));
  check('cmdk-closes', cmdkClosed);

  // 2. Fonts are self-hosted (no Google CDN request)
  const googleFont = await page.evaluate(() =>
    performance.getEntriesByType('resource').some(r => /fonts\.g(oogleapis|static)/.test(r.name)));
  check('no-google-fonts', !googleFont);

  // 3. "What's new" opens and lists entries
  const wn = await page.evaluate(() => {
    document.getElementById('whatsNewBtn')?.click();
    return {
      shown: document.getElementById('modal-whatsnew').classList.contains('show'),
      items: document.querySelectorAll('#whatsNewBody .wn-item').length,
    };
  });
  check('whatsnew-opens', wn.shown);
  check('whatsnew-has-items', wn.items >= 1);

  // 3b. Language switching. The ro/en/ru packs are separate modules now and
  // only the active one is fetched, so a broken dynamic import would show up
  // as the UI silently staying Romanian rather than as an error.
  const ro = await page.evaluate(() => document.getElementById('title').textContent);
  await page.evaluate(() => document.querySelector('.lang-btn[data-lang="ru"]').click());
  const ru = await page.waitForFunction(
    () => document.getElementById('title').textContent.trim() === 'Добро пожаловать',
    null, { timeout: 5000 }
  ).then(() => true).catch(() => false);
  check('i18n-lazy-loads-ru', ru);
  // …and back, which must not need a second fetch.
  await page.evaluate(() => document.querySelector('.lang-btn[data-lang="ro"]').click());
  const backToRo = await page.waitForFunction(
    (want) => document.getElementById('title').textContent === want,
    ro, { timeout: 5000 }
  ).then(() => true).catch(() => false);
  check('i18n-switches-back-to-ro', backToRo);
  // Only the packs actually used should be on the wire — that is the whole
  // point of the split. Assert both halves so neither can pass vacuously.
  const packsFetched = requestedUrls.filter(u => /\/i18n\/(ro|en|ru)\.js/.test(u));
  check('i18n-ru-pack-fetched-on-demand', packsFetched.some(u => u.includes('/i18n/ru.js')));
  check('i18n-en-pack-never-fetched', !packsFetched.some(u => u.includes('/i18n/en.js')));

  // 3c. The how-it-works guide. Its text is lazy-loaded, so a broken import
  // would show as an empty sheet rather than as an error anywhere.
  const guideBefore = requestedUrls.some(u => /\/guide\/ro\.js/.test(u));
  check('guide-not-fetched-until-opened', !guideBefore);
  await page.evaluate(() => document.getElementById('guideBtn').click());
  const guideFilled = await page.waitForFunction(
    () => document.querySelectorAll('#guideBody .guide-step').length > 0,
    null, { timeout: 5000 }
  ).then(() => true).catch(() => false);
  check('guide-opens-and-renders', guideFilled);
  const guide = await page.evaluate(() => ({
    shown: document.getElementById('modal-guide').classList.contains('show'),
    steps: document.querySelectorAll('#guideBody .guide-step').length,
    phases: document.querySelectorAll('#guideBody .guide-phase').length,
    numbered: [...document.querySelectorAll('#guideBody .guide-num')].map(n => n.textContent),
    wheres: document.querySelectorAll('#guideBody .guide-where code').length,
    trouble: document.querySelectorAll('#guideBody .guide-trouble li').length,
    print: !!document.getElementById('guidePrintBtn'),
  }));
  check('guide-modal-shown', guide.shown);
  // 19 steps across 5 phases, plus nav / roles / automatic / troubleshooting.
  check('guide-has-all-steps', guide.steps === 19);
  check('guide-has-all-phases', guide.phases === 9);
  // Numbering runs continuously across phases — "step 9" has to mean one thing.
  check('guide-numbering-continuous',
    guide.numbered.join(',') === Array.from({ length: 19 }, (_, i) => i + 1).join(','));
  check('guide-steps-say-where', guide.wheres === 19);
  check('guide-has-troubleshooting', guide.trouble >= 5);
  check('guide-has-print-button', guide.print);
  await page.evaluate(() => document.querySelector('#modal-guide [data-close]').click());
  await page.waitForTimeout(300);

  // 4. Offline gate queue: seed a cached car, open the gate, check it in offline.
  await page.evaluate(() => {
    localStorage.setItem('kultura_cache_cars', JSON.stringify([
      { id: 991, plate: 'TEST 01', brand: 'Test', model: 'Car', owner: 'QA', zone: '', status: 'Invitat' }
    ]));
    localStorage.removeItem('kultura_outbox');
  });
  await page.reload({ waitUntil: 'networkidle' });
  // Wait for the button to exist rather than guessing with a fixed delay — on a
  // cold CI runner the gate list can take longer than any timeout worth hard-coding.
  await page.waitForSelector('#gateOpenBtn', { state: 'attached' });
  await page.evaluate(() => document.getElementById('gateOpenBtn').click());
  await page.waitForSelector('[data-gate-arrive="991"]', { state: 'attached' });
  await ctx.setOffline(true);
  await page.evaluate(() => document.querySelector('[data-gate-arrive="991"]').click());
  // The check-in is optimistic + queued synchronously, but give the render a tick.
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('kultura_outbox') || '[]').length > 0,
    null, { timeout: 5000 }
  ).catch(() => {}); // fall through to the assertions below for a clear failure
  const gate = await page.evaluate(() => ({
    queued: JSON.parse(localStorage.getItem('kultura_outbox') || '[]').length,
    cached: JSON.parse(localStorage.getItem('kultura_cache_cars') || '[]')[0].status,
  }));
  check('gate-queued-offline', gate.queued === 1);
  check('gate-optimistic-status', gate.cached === 'Sosit');

  // 4b. …and it must come back OUT of the queue when the signal returns.
  // This is the half that actually decides whether a check-in survives, and
  // the global abort route above means it is never otherwise exercised. Stand
  // in for the backend just for the cars endpoint: count the writes, answer
  // them, and let the app drain.
  const patches = [];
  await ctx.route('**://*.supabase.co/rest/v1/cars**', async (route) => {
    const req = route.request();
    if (req.method() !== 'PATCH') return route.abort();  // reads stay cut off
    patches.push({ url: req.url(), body: req.postData() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await ctx.setOffline(false);
  // Going back online is the real trigger the app listens for.
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  const drained = await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('kultura_outbox') || '[]').length === 0,
    null, { timeout: 10000 }
  ).then(() => true).catch(() => false);

  check('gate-outbox-drains-online', drained);
  check('gate-flush-sent-one-write', patches.length === 1);
  check('gate-flush-targets-the-car', patches.length === 1 && /id=eq\.991/.test(patches[0].url));
  check('gate-flush-carries-status', patches.length === 1 && /"status"\s*:\s*"Sosit"/.test(patches[0].body || ''));

  // A second trigger must be a no-op — a check-in re-sent on every reconnect
  // would overwrite later edits with stale values.
  const before = patches.length;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(600);
  check('gate-flush-not-resent', patches.length === before);
  await ctx.unroute('**://*.supabase.co/rest/v1/cars**');

  // 4c. Blocklisted plates must be visible on the car itself, not only in the
  // registration queue it arrived through. Runs in its own context: it needs a
  // signed-in session and goes offline, neither of which should leak into the
  // checks above.
  {
    const bctx = await browser.newContext();
    await bctx.route('**://*.supabase.co/**', (r) => r.abort());
    const bp = await bctx.newPage();
    try {
      await bp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await bp.evaluate(() => {
        // A persisted session so the app boots past the login screen. Every
        // backend call is aborted, so nothing here reaches production.
        localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
          access_token: 'fake', token_type: 'bearer', expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
          user: {
            id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
            aud: 'authenticated', role: 'authenticated',
            app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
          },
        }));
        // The offline app cache a previous online session would have left —
        // including the blocklist, which is what makes the flag work with no
        // signal (the gate case).
        localStorage.setItem('kultura_cache_v1', JSON.stringify({
          cars: [
            { id: 1, brand: 'Dacia', model: 'Logan', owner: 'QA', plate: 'CJ 12 ABC', status: 'Invitat' },
            // Written differently from the blocklist entry on purpose: matching
            // has to survive case and punctuation.
            { id: 2, brand: 'BMW', model: 'M3', owner: 'QA', plate: 'b-100-xyz', status: 'Invitat' },
          ],
          tasks: [], events: [], profiles: [],
          blocklist: [{ plate: 'B 100 XYZ', plate_norm: 'B100XYZ', reason: 'QA reason' }],
          ts: Date.now(),
        }));
      });
      await bp.reload({ waitUntil: 'domcontentloaded' });
      await bp.waitForFunction(
        () => document.querySelectorAll('#carsList .car-row').length === 2,
        null, { timeout: 8000 });
      const list = await bp.evaluate(() => ({
        blocked: document.querySelectorAll('#carsList .car-row.is-blocked').length,
        onBlocked: !!document.querySelector('[data-row-id="2"] .block-badge'),
        onClean: !!document.querySelector('[data-row-id="1"] .block-badge'),
        reason: document.querySelector('[data-row-id="2"] .block-badge')?.title,
      }));
      check('block-hydrates-from-cache', list.onBlocked);
      check('block-card-flagged', list.blocked === 1 && list.onBlocked);
      check('block-clean-car-unflagged', !list.onClean);
      check('block-reason-in-tooltip', list.reason === 'QA reason');

      // Offline first: showCarDetail otherwise awaits a hydration fetch that an
      // aborted route leaves hanging. It is also the real gate scenario.
      await bctx.setOffline(true);
      await bp.evaluate(() => document.querySelector('.tab[data-section="cars"]')?.click());
      await bp.locator('[data-row-id="2"] .row-title').click();
      await bp.waitForSelector('#carDetailBody .block-warn', { state: 'attached', timeout: 5000 });
      const det = await bp.evaluate(() => ({
        warn: (document.querySelector('#carDetailBody .block-warn')?.innerText || ''),
        badges: [...document.querySelectorAll('#carDetailBadges .badge')].map((x) => x.textContent.trim()),
      }));
      check('block-detail-warns', /lista neagră|blocklist|чёрн/i.test(det.warn));
      check('block-detail-shows-reason', det.warn.includes('QA reason'));
      check('block-detail-badge', det.badges.some((b) => /⛔/.test(b)));
    } catch (e) {
      for (const n of ['block-hydrates-from-cache', 'block-card-flagged', 'block-clean-car-unflagged',
        'block-reason-in-tooltip', 'block-detail-warns', 'block-detail-shows-reason', 'block-detail-badge']) {
        if (!checks.some((c) => c.name === n)) check(n, false);
      }
      console.log(`blocklist checks: ${e.message}`);
    }
    await bctx.close();
  }

  // 4d. The other half of the same story: a signed-in session must *write* the
  // blocklist into the offline cache. The checks above seed that cache by hand,
  // so they pass whether or not the app ever persists it — which is exactly the
  // bug being fixed here. Serve the blocklist endpoint for real and look at
  // what lands in localStorage.
  {
    const wctx = await browser.newContext();
    await wctx.route('**://*.supabase.co/**', (r) => r.abort());
    await wctx.route('**://*.supabase.co/rest/v1/plate_blocklist**', (r) =>
      r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ plate: 'B 100 XYZ', plate_norm: 'B100XYZ', reason: 'QA persisted' }]),
      }));
    const wp = await wctx.newPage();
    try {
      await wp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await wp.evaluate(() => {
        localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
          access_token: 'fake', token_type: 'bearer', expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
          user: {
            id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
            aud: 'authenticated', role: 'authenticated',
            app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
          },
        }));
        localStorage.removeItem('kultura_cache_v1');   // start with nothing cached
      });
      await wp.reload({ waitUntil: 'domcontentloaded' });
      const persisted = await wp.waitForFunction(() => {
        const c = JSON.parse(localStorage.getItem('kultura_cache_v1') || 'null');
        return !!(c && Array.isArray(c.blocklist) && c.blocklist.length);
      }, null, { timeout: 10000 }).then(() => true).catch(() => false);
      check('block-persisted-to-cache', persisted);
    } catch (e) {
      if (!checks.some((c) => c.name === 'block-persisted-to-cache')) check('block-persisted-to-cache', false);
      console.log(`blocklist persistence check: ${e.message}`);
    }
    await wctx.close();
  }

  // 4e. Phones must not zoom the app by themselves. iOS enlarges the whole
  // page — and never shrinks it back — whenever a focused form control is
  // under 16px, so a single 14px input anywhere leaves the app stuck zoomed.
  // Checked on a phone viewport across every shipped page, because the floor
  // is a media query and a desktop run would not exercise it.
  {
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mctx.route('**://*.supabase.co/**', (r) => r.abort());
    const small = [];
    const overflowing = [];
    const stillVisible = [];
    for (const name of ['index', 'register', 'vote', 'agenda', 'feedback', 'ticket', 'confirmed', 'privacy']) {
      const mp = await mctx.newPage();
      try {
        await mp.goto(`${BASE}/${name}.html`, { waitUntil: 'domcontentloaded' });
        await mp.waitForTimeout(400);
        const r = await mp.evaluate(() => {
          const tiny = [];
          for (const el of document.querySelectorAll('input, select, textarea')) {
            const t = (el.type || '').toLowerCase();
            if (['hidden', 'checkbox', 'radio', 'range', 'file', 'submit', 'button'].includes(t)) continue;
            const fs = parseFloat(getComputedStyle(el).fontSize);
            if (fs < 16) tiny.push(`${el.tagName.toLowerCase()}#${el.id || el.name || '?'}@${fs}px`);
          }
          return {
            tiny,
            // A page wider than the window reads as "zoomed out" and lets the
            // whole layout slide sideways.
            overflows: document.documentElement.scrollWidth > window.innerWidth + 1,
            // [hidden] must actually hide — an author `display` silently beats
            // the UA rule otherwise.
            shown: [...document.querySelectorAll('[hidden]')]
              .filter((el) => getComputedStyle(el).display !== 'none')
              .map((el) => el.id || String(el.className).slice(0, 30)),
          };
        });
        if (r.tiny.length) small.push(`${name}: ${r.tiny.slice(0, 6).join(', ')}`);
        if (r.overflows) overflowing.push(name);
        if (r.shown.length) stillVisible.push(`${name}: ${r.shown.join(', ')}`);
      } catch (e) {
        small.push(`${name}: ${e.message}`);
      }
      await mp.close();
    }
    check('mobile-no-input-below-16px', small.length === 0);
    if (small.length) console.log('  inputs that make iOS zoom:', small);
    check('mobile-no-horizontal-overflow', overflowing.length === 0);
    if (overflowing.length) console.log('  pages wider than the viewport:', overflowing);
    check('mobile-hidden-attribute-respected', stillVisible.length === 0);
    if (stillVisible.length) console.log('  [hidden] but still displayed:', stillVisible);

    // Pinch-zoom must stay available: blocking it is a WCAG failure, and the
    // 16px floor above exists precisely so we never need to.
    // ticket.html is knowingly excluded — it still ships user-scalable=no from
    // before that rule existed. Left as-is pending a call on it, not an
    // oversight; add it here the moment its viewport is cleaned up.
    const metas = [];
    for (const name of ['index', 'register', 'vote', 'agenda', 'feedback']) {
      const mp = await mctx.newPage();
      await mp.goto(`${BASE}/${name}.html`, { waitUntil: 'domcontentloaded' });
      const v = await mp.evaluate(() =>
        document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '');
      if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*(1|1\.0)\b/.test(v)) metas.push(`${name}: ${v}`);
      await mp.close();
    }
    check('mobile-pinch-zoom-allowed', metas.length === 0);
    if (metas.length) console.log('  viewports that block zoom:', metas);
    await mctx.close();
  }

  // 4f. Pending-registration cards. They sit beside the approved-car rows and
  // are what a reviewer triages from, so they must carry enough to decide on
  // without opening each one. Served from a mocked backend so the real
  // renderer runs.
  {
    const rctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const hr = 3600e3;
    const pic = 'data:image/svg+xml;base64,' + Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#334155"/></svg>').toString('base64');
    const rows = {
      car_registrations: [
        { id: 11, brand: 'Volkswagen', model: 'Golf 5', owner: 'Andrei Toma', plate: 'CJ 12 ABC', city: 'Chișinău',
          status: 'pending', created_at: new Date(Date.now() - 2 * hr).toISOString(), photos: [pic, pic, pic, pic, pic, pic] },
        { id: 12, brand: 'BMW', model: 'M3', owner: 'Vasile Rusu', plate: 'b-100-xyz', city: 'Bălți',
          status: 'pending', created_at: new Date(Date.now() - 26 * hr).toISOString(), photos: [] },
        // Sparse on purpose: missing plate/city must not render as dashes.
        { id: 13, brand: 'Mazda', model: 'RX-7', owner: 'Ion Iovu', plate: null, city: null,
          status: 'pending', created_at: new Date(Date.now() - 10 * 60e3).toISOString(), photos: [] },
      ],
      plate_blocklist: [{ plate: 'B 100 XYZ', plate_norm: 'B100XYZ', reason: 'QA reason' }],
      profiles: [{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }],
      cars: [],
    };
    await rctx.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url();
      if (r.request().method() !== 'GET' || !u.includes('/rest/v1/')) return r.abort();
      const table = Object.keys(rows).find((k) => u.includes(`/rest/v1/${k}`));
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[table] || []) });
    });
    const rp = await rctx.newPage();
    try {
      await rp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await rp.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      })));
      await rp.reload({ waitUntil: 'domcontentloaded' });
      await rp.waitForSelector('#regQueue .reg-card', { state: 'attached', timeout: 12000 });
      const q = await rp.evaluate(() => {
        const first = document.querySelector('[data-reg-open="11"]');
        const sparse = document.querySelector('[data-reg-open="13"]');
        const blocked = document.querySelector('[data-reg-open="12"]');
        const txt = (el, sel) => el?.querySelector(sel)?.textContent.trim() || '';
        return {
          count: document.querySelectorAll('#regQueue .reg-card').length,
          hasIcon: !!first?.querySelector('.reg-card-icon'),
          facts: txt(first, '.reg-card-facts'),
          age: txt(first, '.reg-age'),
          thumbs: first?.querySelectorAll('.reg-card-thumbs img').length || 0,
          more: txt(first, '.reg-card-more'),
          sparseFacts: txt(sparse, '.reg-card-facts'),
          blockedFlagged: !!blocked?.classList.contains('is-blocked') && !!blocked?.querySelector('.block-badge'),
          // No leftover decorative empty bar above the queue.
          accent: document.querySelectorAll('.reg-accent').length,
        };
      });
      check('reg-card-count', q.count === 3);
      check('reg-card-has-icon', q.hasIcon);
      check('reg-card-shows-owner-plate-city',
        /Andrei Toma/.test(q.facts) && /CJ 12 ABC/.test(q.facts) && /Chișinău/.test(q.facts));
      check('reg-card-shows-wait-time', /acum/.test(q.age));
      check('reg-card-thumbs-capped', q.thumbs === 4 && q.more === '+2');
      // A registration with no plate/city shows the owner alone, not placeholders.
      check('reg-card-skips-missing-fields',
        /Ion Iovu/.test(q.sparseFacts) && !/—/.test(q.sparseFacts));
      check('reg-card-blocklist-flagged', q.blockedFlagged);
      check('reg-no-empty-accent-bar', q.accent === 0);

      // The approved column must not be squeezed two-up inside its half.
      const cols = await rp.evaluate(() =>
        getComputedStyle(document.querySelector('.cars-col-approved .page-grid-2') || document.body)
          .gridTemplateColumns.split(' ').filter(Boolean).length);
      check('cars-split-approved-single-column-when-narrow', cols === 1);
    } catch (e) {
      for (const n of ['reg-card-count', 'reg-card-has-icon', 'reg-card-shows-owner-plate-city',
        'reg-card-shows-wait-time', 'reg-card-thumbs-capped', 'reg-card-skips-missing-fields',
        'reg-card-blocklist-flagged', 'reg-no-empty-accent-bar',
        'cars-split-approved-single-column-when-narrow']) {
        if (!checks.some((c) => c.name === n)) check(n, false);
      }
      console.log(`reg card checks: ${e.message}`);
    }
    await rctx.close();
  }

  // 4g. Backup freshness banner. run_backup() posts to the edge function and
  // never reads the reply, so cron reports "succeeded" even when the backup
  // failed — a recent file is the only honest evidence. Drive all three states.
  {
    const stamp = (ms) => new Date(ms).toISOString().replace(/[:.]/g, '-');
    for (const [label, files, wantBad] of [
      ['fresh', [{ name: `kultura-backup-${stamp(Date.now() - 3 * 3600e3)}.json`, metadata: { size: 49000 } }], false],
      ['stale', [{ name: `kultura-backup-${stamp(Date.now() - 5 * 86400e3)}.json`, metadata: { size: 49000 } }], true],
      ['none', [], true],
    ]) {
      const hctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
      await hctx.route('**://*.supabase.co/**', (r) => {
        const u = r.request().url();
        if (u.includes('/storage/v1/object/list/backups')) {
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(files) });
        }
        if (u.includes('/rest/v1/profiles')) {
          return r.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]) });
        }
        if (u.includes('/rest/v1/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return r.abort();
      });
      const hp = await hctx.newPage();
      try {
        await hp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
        await hp.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
          access_token: 'fake', token_type: 'bearer', expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
          user: {
            id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
            aud: 'authenticated', role: 'authenticated',
            app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
          },
        })));
        await hp.reload({ waitUntil: 'domcontentloaded' });
        await hp.waitForFunction(
          () => { const h = document.getElementById('backupHealth'); return h && !h.hidden; },
          null, { timeout: 10000 });
        const h = await hp.evaluate(() => {
          const x = document.getElementById('backupHealth');
          return { bad: x.classList.contains('is-bad'), ok: x.classList.contains('is-ok'), txt: x.textContent.trim() };
        });
        check(`backup-health-${label}`, wantBad ? (h.bad && !h.ok) : (h.ok && !h.bad));
        check(`backup-health-${label}-has-text`, h.txt.length > 10);
      } catch (e) {
        if (!checks.some((c) => c.name === `backup-health-${label}`)) check(`backup-health-${label}`, false);
        if (!checks.some((c) => c.name === `backup-health-${label}-has-text`)) check(`backup-health-${label}-has-text`, false);
        console.log(`backup health (${label}): ${e.message}`);
      }
      await hctx.close();
    }
  }

  // 4h. Event scoping. The whole app follows one event; finishing it moves the
  // focus on, which is how "the data disappears when the event is over" is
  // meant to work — visually, never destructively. The finished event must
  // still be one pick away.
  {
    const CARS = [
      { id: 1, brand: 'A', model: 'Unu', owner: 'o', plate: 'P1', status: 'Invitat', event_id: 6 },
      { id: 2, brand: 'B', model: 'Doi', owner: 'o', plate: 'P2', status: 'Invitat', event_id: 6 },
      { id: 3, brand: 'C', model: 'Trei', owner: 'o', plate: 'P3', status: 'Invitat', event_id: 3 },
      // No event: predates scoping, so it must stay visible under every event
      // rather than vanish (that would read as data loss).
      { id: 4, brand: 'D', model: 'Patru', owner: 'o', plate: 'P4', status: 'Invitat', event_id: null },
    ];
    const ACTIVE = { id: 6, title: 'Weekend Festival', status: 'Activ', archived: false };
    const DONE = { id: 6, title: 'Weekend Festival', status: 'Finalizat', archived: false };
    const PLANNED = { id: 3, title: 'Retro Expo', status: 'Planificat', archived: false };

    const scope = async (events, pick) => {
      const ectx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
      await ectx.route('**://*.supabase.co/**', (r) => {
        const u = r.request().url();
        const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
        if (u.includes('/rest/v1/cars')) return J(CARS);
        if (u.includes('/rest/v1/events')) return J(events);
        if (u.includes('/rest/v1/profiles')) {
          return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
        }
        if (u.includes('/rest/v1/')) return J([]);
        return r.abort();
      });
      const ep = await ectx.newPage();
      await ep.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await ep.evaluate((p) => {
        localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
          access_token: 'fake', token_type: 'bearer', expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
          user: {
            id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
            aud: 'authenticated', role: 'authenticated',
            app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
          },
        }));
        if (p === null) localStorage.removeItem('kultura_active_event');
        else localStorage.setItem('kultura_active_event', p);
      }, pick);
      await ep.reload({ waitUntil: 'domcontentloaded' });
      await ep.waitForSelector('#carsList .car-row', { state: 'attached', timeout: 10000 }).catch(() => {});
      await ep.waitForTimeout(700);
      const out = await ep.evaluate(() => ({
        picked: document.getElementById('activeEventSelect')?.value,
        plates: [...document.querySelectorAll('#carsList .car-row')]
          .map((x) => (x.querySelector('.row-sub')?.textContent.match(/P\d/) || [])[0])
          .filter(Boolean).sort(),
      }));
      await ectx.close();
      return out;
    };

    try {
      const a = await scope([ACTIVE, PLANNED], null);
      check('event-scope-defaults-to-active', a.picked === '6');
      check('event-scope-shows-only-that-event', a.plates.join() === 'P1,P2,P4');

      const b2 = await scope([DONE, PLANNED], null);
      check('event-scope-moves-on-when-finished', b2.picked === '3');
      check('event-scope-finished-data-hidden', !b2.plates.includes('P1') && !b2.plates.includes('P2'));

      const c = await scope([DONE, PLANNED], '6');
      check('event-scope-finished-still-reachable', c.plates.join() === 'P1,P2,P4');

      const d = await scope([ACTIVE, PLANNED], '');
      check('event-scope-all-shows-everything', d.plates.join() === 'P1,P2,P3,P4');

      // The unassigned row appears under every scope — never swallowed.
      check('event-scope-unassigned-always-visible',
        [a, b2, c, d].every((x) => x.plates.includes('P4')));

      // Counts, the approval queue and the public link must follow the scope
      // too. They didn't at first: the list filtered but the chips above it
      // kept advertising cars from other events.
      const CARS2 = [
        { id: 1, brand: 'A', model: 'Unu', owner: 'o', plate: 'P1', status: 'Sosit', zone: 'Stance', event_id: 6 },
        { id: 2, brand: 'B', model: 'Doi', owner: 'o', plate: 'P2', status: 'Invitat', zone: 'JDM', event_id: 6 },
        { id: 3, brand: 'C', model: 'Trei', owner: 'o', plate: 'P3', status: 'Invitat', zone: 'Retro', event_id: 3 },
      ];
      const TASKS2 = [
        { id: 1, title: 'T1', status: 'available', event_id: 6 },
        { id: 2, title: 'T2', status: 'available', event_id: 3 },
      ];
      const REGS2 = [
        { id: 11, brand: 'R', model: 'Ev6', owner: 'o', plate: 'R1', status: 'pending', event_id: 6, photos: [], created_at: new Date().toISOString() },
        { id: 12, brand: 'R', model: 'Ev3', owner: 'o', plate: 'R2', status: 'pending', event_id: 3, photos: [], created_at: new Date().toISOString() },
      ];
      const cctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
      await cctx.route('**://*.supabase.co/**', (r) => {
        const u = r.request().url();
        const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
        if (u.includes('/rest/v1/car_registrations')) return J(REGS2);
        if (u.includes('/rest/v1/cars')) return J(CARS2);
        if (u.includes('/rest/v1/tasks')) return J(TASKS2);
        if (u.includes('/rest/v1/events')) return J([ACTIVE, PLANNED]);
        if (u.includes('/rest/v1/profiles')) {
          return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
        }
        if (u.includes('/rest/v1/')) return J([]);
        return r.abort();
      });
      const cp = await cctx.newPage();
      await cp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await cp.evaluate(() => {
        localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
          access_token: 'fake', token_type: 'bearer', expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
          user: {
            id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
            aud: 'authenticated', role: 'authenticated',
            app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
          },
        }));
        localStorage.removeItem('kultura_active_event');
      });
      await cp.reload({ waitUntil: 'domcontentloaded' });
      await cp.waitForSelector('#carsList .car-row', { state: 'attached', timeout: 12000 }).catch(() => {});
      await cp.waitForTimeout(1200);
      const readCounts = () => cp.evaluate(() => {
        const n = (s) => {
          const el2 = [...document.querySelectorAll(s)][0];
          return el2 ? Number((el2.textContent.match(/(\d+)\s*$/) || [])[1]) : null;
        };
        return {
          carsCount: Number(document.getElementById('carsCount')?.textContent),
          carsAll: n('#carsChips .chip'),
          tasksAll: n('#tasksChips .chip'),
          regs: document.querySelectorAll('#regQueue .reg-card').length,
          pubLink: document.getElementById('regLink')?.value || '',
        };
      });
      const on6 = await readCounts();
      check('scope-cars-count-follows', on6.carsCount === 2);
      check('scope-cars-chip-follows', on6.carsAll === 2);
      check('scope-tasks-chip-follows', on6.tasksAll === 1);
      check('scope-reg-queue-follows', on6.regs === 1);
      check('scope-public-link-carries-event', /[?&]event=6\b/.test(on6.pubLink));

      await cp.evaluate(() => {
        const s = document.getElementById('activeEventSelect');
        s.value = '3'; s.dispatchEvent(new Event('change'));
      });
      await cp.waitForTimeout(900);
      const on3 = await readCounts();
      check('scope-counts-update-on-switch',
        on3.carsCount === 1 && on3.carsAll === 1 && on3.tasksAll === 1 && on3.regs === 1);
      await cctx.close();
    } catch (e) {
      for (const n of ['event-scope-defaults-to-active', 'event-scope-shows-only-that-event',
        'event-scope-moves-on-when-finished', 'event-scope-finished-data-hidden',
        'event-scope-finished-still-reachable', 'event-scope-all-shows-everything',
        'event-scope-unassigned-always-visible', 'scope-cars-count-follows',
        'scope-cars-chip-follows', 'scope-tasks-chip-follows', 'scope-reg-queue-follows',
        'scope-public-link-carries-event', 'scope-counts-update-on-switch']) {
        if (!checks.some((c2) => c2.name === n)) check(n, false);
      }
      console.log(`event scope checks: ${e.message}`);
    }
  }

  // 4i. Entry numbers + judging. The number is how a car show identifies a car
  // to everyone not holding its paperwork; judging is the panel score, grouped
  // by the car's existing class.
  {
    const CARS = [
      { id: 1, entry_no: 1, brand: 'VW', model: 'Golf', owner: 'A', plate: 'P1', status: 'Sosit', category: 'Performance', event_id: 6 },
      { id: 2, entry_no: 2, brand: 'Mazda', model: 'RX-7', owner: 'B', plate: 'P2', status: 'Sosit', category: 'JDM', event_id: 6 },
      { id: 3, entry_no: 3, brand: 'BMW', model: 'E30', owner: 'C', plate: 'P3', status: 'Invitat', category: 'Retro', event_id: 6 },
      { id: 4, entry_no: 4, brand: 'Nissan', model: 'Silvia', owner: 'D', plate: 'P4', status: 'Sosit', category: 'JDM', event_id: 6 },
    ];
    let scores = [];
    const jctx = await browser.newContext({ viewport: { width: 430, height: 930 }, isMobile: true, hasTouch: true });
    await jctx.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url(), m = r.request().method();
      const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (u.includes('/rest/v1/judge_scores')) {
        if (m === 'GET') return J(scores);
        const rows = [].concat(JSON.parse(r.request().postData() || '{}'));
        for (const row of rows) {
          const i = scores.findIndex((s) => String(s.car_id) === String(row.car_id) && s.judge_email === row.judge_email);
          if (i >= 0) scores[i] = row; else scores.push(row);
        }
        return J(rows);
      }
      if (u.includes('/rest/v1/cars')) return J(CARS);
      if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'Festival', status: 'Activ', archived: false }]);
      if (u.includes('/rest/v1/profiles')) {
        return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
      }
      if (u.includes('/rest/v1/')) return J([]);
      return r.abort();
    });
    const jp = await jctx.newPage();
    try {
      await jp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await jp.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      })));
      await jp.reload({ waitUntil: 'domcontentloaded' });
      await jp.waitForTimeout(2200);
      await jp.evaluate(() => {
        document.getElementById('splashScreen')?.remove();
        document.querySelector('.mtab[data-section="cars"], .tab[data-section="cars"]')?.click();
      });
      await jp.waitForTimeout(600);
      const nos = await jp.evaluate(() =>
        [...document.querySelectorAll('#carsList .entry-no')].map((x) => x.textContent));
      check('entry-no-on-car-cards', nos.join() === '#1,#2,#3,#4');

      await jp.evaluate(() => document.getElementById('judgeBtn').click());
      await jp.waitForSelector('#judgeResults .judge-car', { state: 'visible', timeout: 8000 });
      const before = await jp.evaluate(() => document.getElementById('judgeProgress').textContent);
      check('judge-progress-starts-empty', /0/.test(before));

      for (const [car, score] of [[1, 9], [2, 7], [4, 10]]) {
        await jp.click(`[data-judge-car="${car}"][data-judge-score="${score}"]`);
        await jp.waitForTimeout(300);
      }
      const after = await jp.evaluate(() => ({
        prog: document.getElementById('judgeProgress').textContent,
        set: [...document.querySelectorAll('.judge-score.is-set')].map((x) => x.dataset.judgeCar + '=' + x.textContent).sort(),
      }));
      check('judge-scores-persist', after.set.join() === '1=9,2=7,4=10');
      check('judge-progress-counts', /3/.test(after.prog));

      // "Not scored" must leave exactly the one car nobody rated.
      await jp.evaluate(() => document.querySelector('[data-judge-filter="todo"]').click());
      await jp.waitForTimeout(300);
      const todo = await jp.evaluate(() => document.querySelectorAll('#judgeResults .judge-car').length);
      check('judge-todo-filter', todo === 1);

      // Searching by the number on the windscreen — the whole point of #1.
      await jp.evaluate(() => document.querySelector('[data-judge-filter="all"]').click());
      await jp.fill('#judgeSearch', '2');
      await jp.waitForTimeout(300);
      const found = await jp.evaluate(() =>
        [...document.querySelectorAll('#judgeResults .entry-no')].map((x) => x.textContent));
      check('judge-search-by-entry-no', found.join() === '#2');

      await jp.fill('#judgeSearch', '');
      await jp.evaluate(() => document.getElementById('judgeResultsBtn').click());
      await jp.waitForTimeout(500);
      const res = await jp.evaluate(() => ({
        classes: [...document.querySelectorAll('.judge-class-t')].map((x) => x.textContent).sort(),
        winners: [...document.querySelectorAll('.judge-res.is-win')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
      }));
      // Only classes with at least one score appear; Retro was never scored.
      check('judge-results-per-class', res.classes.join() === 'JDM,PERFORMANCE'
        || res.classes.join() === 'JDM,Performance');
      check('judge-picks-class-winners',
        res.winners.some((w) => /#4/.test(w) && /10/.test(w))
        && res.winners.some((w) => /#1/.test(w) && /9/.test(w)));
    } catch (e) {
      for (const n of ['entry-no-on-car-cards', 'judge-progress-starts-empty', 'judge-scores-persist',
        'judge-progress-counts', 'judge-todo-filter', 'judge-search-by-entry-no',
        'judge-results-per-class', 'judge-picks-class-winners']) {
        if (!checks.some((c) => c.name === n)) check(n, false);
      }
      console.log(`judging checks: ${e.message}`);
    }
    await jctx.close();
  }

  // 4j. Waiver + waitlist on the public registration form. Both are driven by
  // the event, so the form must react to what event-info reports.
  {
    for (const [label, ev, wantWaiver, wantFull] of [
      ['waiver', { id: 6, title: 'F', waiver_text: 'Particip pe propria răspundere.', spots_left: 40 }, true, false],
      ['full', { id: 6, title: 'F', waiver_text: '', spots_left: 0 }, false, true],
      ['plain', { id: 6, title: 'F', waiver_text: '', spots_left: null }, false, false],
    ]) {
      const wctx = await browser.newContext({ viewport: { width: 430, height: 930 } });
      await wctx.route('**://*.supabase.co/**', (r) => {
        const u = r.request().url();
        if (u.includes('/functions/v1/event-info')) {
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: ev, agenda: [] }) });
        }
        return r.abort();
      });
      const wp = await wctx.newPage();
      try {
        await wp.goto(`${BASE}/register.html`, { waitUntil: 'domcontentloaded' });
        await wp.waitForTimeout(900);
        const st = await wp.evaluate(() => ({
          waiver: document.getElementById('waiverBox').style.display !== 'none',
          cap: document.getElementById('capNote').style.display !== 'none',
          full: document.getElementById('capNote').classList.contains('is-full'),
        }));
        check(`register-${label}-waiver-shown`, st.waiver === wantWaiver);
        check(`register-${label}-capacity-notice`, st.cap === wantFull);
        if (wantFull) check('register-full-notice-is-red', st.full);
      } catch (e) {
        console.log(`register ${label}: ${e.message}`);
        check(`register-${label}-waiver-shown`, false);
        check(`register-${label}-capacity-notice`, false);
      }
      await wctx.close();
    }
  }

  // 4k. Trash, undoable imports, and RSVP badges. The activity log showed 1.670
  // cars deleted by hand in two days — importing, disliking it, wiping, redoing.
  // Deleting is reversible now, and an import is one batch you can take back.
  {
    const CARS = [
      { id: 1, entry_no: 1, brand: 'VW', model: 'Golf', owner: 'A', plate: 'P1', status: 'Sosit', category: 'Performance', event_id: 6, rsvp: null, deleted_at: null },
      { id: 2, entry_no: 2, brand: 'Mazda', model: 'RX-7', owner: 'B', plate: 'P2', status: 'Sosit', category: 'JDM', event_id: 6, rsvp: 'no', deleted_at: null },
      { id: 3, entry_no: 3, brand: 'BMW', model: 'E30', owner: 'C', plate: 'P3', status: 'Invitat', category: 'Retro', event_id: 6, rsvp: 'yes', deleted_at: null },
    ];
    const TRASH = [{
      id: 9, entry_no: 7, brand: 'Audi', model: 'S4', owner: 'Z', plate: 'P9', event_id: 6,
      deleted_at: new Date(Date.now() - 3600e3).toISOString(), deleted_by: 'qa@example.com',
    }];
    const IMPORTS = [
      { id: 5, source: 'google-sheet', inserted: 12, skipped: 1, total: 13, note: null, batch: 'b-1', undone_at: null, created_at: new Date(Date.now() - 7200e3).toISOString() },
      { id: 4, source: 'google-sheet', inserted: 3, skipped: 0, total: 3, note: null, batch: 'b-0', undone_at: new Date().toISOString(), created_at: new Date(Date.now() - 86400e3).toISOString() },
    ];
    const tctx = await browser.newContext({ viewport: { width: 430, height: 930 }, isMobile: true, hasTouch: true });
    await tctx.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url();
      const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (u.includes('/rest/v1/cars')) return J(/deleted_at=not\.is\.null/.test(u) ? TRASH : CARS);
      if (u.includes('/rest/v1/import_log')) return J(IMPORTS);
      if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'Festival', status: 'Activ', archived: false, entries_frozen: false }]);
      if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
      if (u.includes('/rest/v1/app_config')) return J([{ key: 'telegram_bot_username', value: 'kultura_test_bot' }, { key: 'telegram_bot_token', value: 'secret-token-value' }]);
      if (u.includes('/rest/v1/ui_settings')) return J([{ key: 'notify_prefer_telegram', value: '1' }, { key: 'public_base_url', value: 'https://kultura.example' }]);
      if (u.includes('/rest/v1/')) return J([]);
      return r.abort();
    });
    const tp = await tctx.newPage();
    try {
      await tp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await tp.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      })));
      await tp.reload({ waitUntil: 'domcontentloaded' });
      await tp.waitForTimeout(2200);
      await tp.evaluate(() => {
        document.getElementById('splashScreen')?.remove();
        document.querySelector('.mtab[data-section="cars"], .tab[data-section="cars"]')?.click();
      });
      await tp.waitForTimeout(600);
      const badges = await tp.evaluate(() =>
        [...document.querySelectorAll('#carsList .rsvp-badge')]
          .map((x) => (x.classList.contains('is-no') ? 'no' : 'yes')));
      check('rsvp-badges-on-cards', badges.join() === 'no,yes');

      await tp.evaluate(() => document.querySelector('.mtab[data-section="settings"], .tab[data-section="settings"]')?.click());
      await tp.waitForTimeout(1200);
      const s = await tp.evaluate(() => ({
        trashShown: getComputedStyle(document.getElementById('trashBlock')).display,
        rows: [...document.querySelectorAll('#trashList .backup-row strong')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
        restores: document.querySelectorAll('#trashList [data-trash-restore]').length,
        // The badge must hug its text; a stray `display:block` from the settings
        // pane once stretched it into a bar across the whole row.
        badgeW: document.querySelector('#trashList .entry-no')?.getBoundingClientRect().width ?? 0,
        rowW: document.querySelector('#trashList .backup-row')?.getBoundingClientRect().width ?? 1,
        imports: [...document.querySelectorAll('#importList [data-import-undo]')].map((x) => x.dataset.importUndo),
        importRows: document.querySelectorAll('#importList .backup-row').length,
        tgShown: getComputedStyle(document.getElementById('telegramBlock')).display,
        tokenValue: document.getElementById('tgToken').value,
        baseUrl: document.getElementById('publicBaseUrl').value,
      }));
      check('trash-panel-visible-to-admin', s.trashShown === 'block');
      check('trash-lists-deleted-car', s.rows.length === 1 && /#7/.test(s.rows[0]) && /Audi S4/.test(s.rows[0]));
      check('trash-offers-restore', s.restores === 1);
      check('trash-entry-badge-not-stretched', s.badgeW > 0 && s.badgeW < s.rowW / 3);
      check('imports-listed', s.importRows === 2);
      // Only the batch that has not been undone may be undone again.
      check('import-undo-only-for-live-batch', s.imports.join() === 'b-1');
      check('telegram-panel-visible-to-admin', s.tgShown === 'block');
      // The stored bot token must never be echoed back into the page.
      check('telegram-token-never-echoed', s.tokenValue === '');
      check('public-base-url-loaded', s.baseUrl === 'https://kultura.example');
    } catch (e) {
      for (const n of ['rsvp-badges-on-cards', 'trash-panel-visible-to-admin', 'trash-lists-deleted-car',
        'trash-offers-restore', 'trash-entry-badge-not-stretched', 'imports-listed',
        'import-undo-only-for-live-batch', 'telegram-panel-visible-to-admin',
        'telegram-token-never-echoed', 'public-base-url-loaded']) {
        if (!checks.some((c) => c.name === n)) check(n, false);
      }
      console.log(`trash/telegram checks: ${e.message}`);
    }
    await tctx.close();
  }

  // 4l. The "are you coming?" page. A "no" frees a spot, so the page has to be
  // right about which answer it is sending and has to keep working for someone
  // who changes their mind.
  {
    const car = { entry_no: 12, brand: 'Nissan', model: 'Silvia', plate: 'XYZ 123', owner: 'Ion', zone: 'A2' };
    const event = { title: 'Kultura Fest', starts_at: null, location: 'Chisinau' };
    for (const [label, initial, mode] of [
      ['fresh', null, 'ok'],
      ['answered', 'yes', 'ok'],
      ['forbidden', null, 'fail'],
    ]) {
      const cctx = await browser.newContext({ viewport: { width: 430, height: 930 } });
      let posted = null;
      await cctx.route('**://*.supabase.co/**', (r) => {
        const req = r.request();
        if (!req.url().includes('/functions/v1/rsvp')) return r.abort();
        if (mode === 'fail') return r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'forbidden' }) });
        if (req.method() === 'POST') {
          posted = JSON.parse(req.postData() || '{}');
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, car, event, rsvp: posted.answer, rsvp_at: new Date().toISOString() }) });
        }
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, car, event, rsvp: initial, rsvp_at: initial ? new Date().toISOString() : null }) });
      });
      const cp = await cctx.newPage();
      try {
        await cp.goto(`${BASE}/confirm.html?c=42&t=${'a'.repeat(24)}`, { waitUntil: 'domcontentloaded' });
        await cp.waitForTimeout(800);
        const v = await cp.evaluate(() => ({
          no: document.getElementById('carNo').textContent.trim(),
          name: document.getElementById('carName').textContent.trim(),
          ask: document.getElementById('askBox').style.display,
          state: document.getElementById('state').className,
          title: document.getElementById('title').textContent.trim(),
        }));
        if (mode === 'fail') {
          check('confirm-bad-token-refuses', /invalid/i.test(v.title) && v.ask === 'none');
        } else {
          check(`confirm-${label}-shows-car`, v.no === '#12' && /Nissan Silvia/.test(v.name));
          check(`confirm-${label}-asks`, v.ask === 'block');
          if (label === 'answered') {
            // Already answered: show it, but leave the buttons — changing your
            // mind is the normal case, not an error.
            check('confirm-shows-previous-answer', /is-yes/.test(v.state));
          } else {
            check('confirm-fresh-has-no-state', !/show/.test(v.state));
            await cp.click('#btnNo');
            await cp.waitForTimeout(400);
            check('confirm-sends-the-answer', posted && posted.answer === 'no' && posted.c === '42');
            check('confirm-reflects-no', /is-no/.test(await cp.evaluate(() => document.getElementById('state').className)));
          }
        }
      } catch (e) {
        // Register every check this scenario owns, or a thrown error quietly
        // shrinks the suite instead of failing it.
        const owned = mode === 'fail'
          ? ['confirm-bad-token-refuses']
          : label === 'answered'
            ? ['confirm-answered-shows-car', 'confirm-answered-asks', 'confirm-shows-previous-answer']
            : ['confirm-fresh-shows-car', 'confirm-fresh-asks', 'confirm-fresh-has-no-state',
              'confirm-sends-the-answer', 'confirm-reflects-no'];
        for (const n of owned) if (!checks.some((c) => c.name === n)) check(n, false);
        console.log(`confirm ${label}: ${e.message}`);
      }
      await cctx.close();
    }
  }

  // 5. Public pages (given out by QR at the event) must render standalone.
  // They talk to Supabase, which is unreachable here, so we only assert the
  // static shell renders and nothing throws before the network call.
  for (const [name, sel] of [
    ['register', '#regForm'],
    ['vote', '#content'],
    ['agenda', '#content'],
    ['feedback', '#stars'],
  ]) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    try {
      await p.goto(`${BASE}/${name}.html`, { waitUntil: 'domcontentloaded' });
      await p.waitForSelector(sel, { state: 'attached', timeout: 5000 });
      check(`public:${name}-renders`, true);
    } catch (e) {
      check(`public:${name}-renders`, false);
      console.log(`${name}.html: ${e.message}`);
    }
    const real = errs.filter((e) => !/supabase|network|fetch|401|403|Failed to fetch/i.test(e));
    check(`public:${name}-no-errors`, real.length === 0);
    if (real.length) console.log(`${name}.html errors:`, real);
    await p.close();
  }

  // 5b. Accessibility (WCAG 2 A/AA) on every page we ship. Skipped when
  // axe-core isn't installed, so the suite still runs without it.
  const axePath = resolve(ROOT, 'node_modules/axe-core/axe.min.js');
  if (existsSync(axePath)) {
    const axeSrc = readFileSync(axePath, 'utf8');
    for (const name of ['index', 'register', 'vote', 'agenda', 'feedback']) {
      const p = await ctx.newPage();
      try {
        await p.goto(`${BASE}/${name}.html`, { waitUntil: 'domcontentloaded' });
        await p.waitForTimeout(700);
        await p.addScriptTag({ content: axeSrc });
        const res = await p.evaluate(async () =>
          await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }));
        const v = res.violations.filter((x) => x.nodes.length);
        check(`a11y:${name}`, v.length === 0);
        for (const x of v) console.log(`  a11y ${name}: [${x.impact}] ${x.id} — ${x.help} (${x.nodes[0].target.join(' ')})`);
      } catch (e) {
        check(`a11y:${name}`, false);
        console.log(`  a11y ${name}: ${e.message}`);
      }
      await p.close();
    }

    // The guide's markup only exists once the modal is open, so the page sweep
    // above never sees it. Its numbered chips are brand magenta, and magenta
    // has failed contrast here before — measure it rather than assume.
    const gp = await ctx.newPage();
    try {
      await gp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await gp.waitForSelector('#guideBtn', { state: 'attached' });
      await gp.evaluate(() => document.getElementById('guideBtn').click());
      await gp.waitForFunction(
        () => document.querySelectorAll('#guideBody .guide-step').length > 0,
        null, { timeout: 5000 });
      await gp.addScriptTag({ content: axeSrc });
      const res = await gp.evaluate(async () =>
        await window.axe.run('#modal-guide', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }));
      const v = res.violations.filter((x) => x.nodes.length);
      check('a11y:guide-modal', v.length === 0);
      for (const x of v) console.log(`  a11y guide: [${x.impact}] ${x.id} — ${x.help} (${x.nodes[0].target.join(' ')})`);
    } catch (e) {
      check('a11y:guide-modal', false);
      console.log(`  a11y guide: ${e.message}`);
    }
    await gp.close();
  } else {
    console.log('axe-core not installed — skipping accessibility checks');
  }

  // 6. No uncaught JS errors during the run (ignore network/auth noise)
  const realErrors = jsErrors.filter(e => !/supabase|network|fetch|401|403/i.test(e));
  check('no-js-errors', realErrors.length === 0);
  if (realErrors.length) console.log('JS errors:', realErrors);

} finally {
  if (browser) await browser.close();
  srv.kill();
}

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
process.exit(failed.length ? 1 : 0);
