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
  // 17 steps across 5 phases, plus nav / roles / automatic / troubleshooting.
  check('guide-has-all-steps', guide.steps === 17);
  check('guide-has-all-phases', guide.phases === 9);
  // Numbering runs continuously across phases — "step 9" has to mean one thing.
  check('guide-numbering-continuous',
    guide.numbered.join(',') === Array.from({ length: 17 }, (_, i) => i + 1).join(','));
  check('guide-steps-say-where', guide.wheres === 17);
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
