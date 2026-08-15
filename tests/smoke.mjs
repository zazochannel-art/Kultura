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
import { existsSync } from 'node:fs';
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
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));

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
  await ctx.setOffline(false);

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
