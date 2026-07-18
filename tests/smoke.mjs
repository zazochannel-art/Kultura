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
  }));
  Object.entries(els).forEach(([k, v]) => check('element:' + k, v));

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
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById('gateOpenBtn').click());
  await ctx.setOffline(true);
  await page.evaluate(() => document.querySelector('[data-gate-arrive="991"]').click());
  await page.waitForTimeout(300);
  const gate = await page.evaluate(() => ({
    queued: JSON.parse(localStorage.getItem('kultura_outbox') || '[]').length,
    cached: JSON.parse(localStorage.getItem('kultura_cache_cars') || '[]')[0].status,
  }));
  check('gate-queued-offline', gate.queued === 1);
  check('gate-optimistic-status', gate.cached === 'Sosit');
  await ctx.setOffline(false);

  // 5. No uncaught JS errors during the run (ignore network/auth noise)
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
