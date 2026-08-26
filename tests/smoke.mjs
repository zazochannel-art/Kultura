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
import zlib from 'node:zlib';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8199;
const BASE = `http://localhost:${PORT}`;

const checks = [];
const check = (name, cond) => { checks.push({ name, ok: !!cond }); };

// The map shows a zoom at once and commits its size a beat later — the size is
// the sharp half, so every assertion about the map's geometry is about the
// committed state. Wait for it rather than for a clock.
// Best-effort: if the size never commits, the checks below should say so
// themselves — one clear failure beats a section that falls over on a wait.
const mapSettled = (page) => page.waitForFunction(
  () => !/scale/.test(document.getElementById('mapImageWrap')?.style.transform || ''),
  null, { timeout: 5000 }).catch(() => {});

// A valid one-page 400x200 PDF, built rather than committed: the PDF branch of
// the template picker needs something real to parse, and a binary fixture in
// the tree would be one more thing nobody can read in a diff.
// A PNG of pure noise at a given size — the worst case a map upload can hand
// the encoder, and the only kind that reliably blows the bucket's 5 MB ceiling.
function noisyPng(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0, seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 256;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) { raw[o++] = rnd(); raw[o++] = rnd(); raw[o++] = rnd(); }
  }
  const crc32 = (buf) => {
    let c = ~0;
    for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function tinyPdf() {
  const stream = '1 0 0 RG 6 w 20 20 m 380 180 l S 0 0 1 rg 40 40 120 60 re f';
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents 4 0 R/Resources<<>>>>',
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of off) out += String(o).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

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

  // The VIP-guests module was removed: it held zero rows for the whole life of
  // the app while taking a slot in the menu that a gate volunteer also saw.
  // The VIP *flag on a car* is a different thing and stays — pinned below.
  const vipGone = await page.evaluate(() => ({
    section: !!document.getElementById('section-vip'),
    list: !!document.getElementById('vipList'),
    addModal: !!document.getElementById('modal-add-vip'),
    detailModal: !!document.getElementById('modal-vip-detail'),
    tab: !!document.querySelector('[data-section="vip"]'),
    deleteAll: !!document.getElementById('deleteAllVipsBtn'),
  }));
  check('vip-module-section-gone', !vipGone.section);
  check('vip-module-list-gone', !vipGone.list);
  check('vip-module-modals-gone', !vipGone.addModal && !vipGone.detailModal);
  check('vip-module-tab-gone', !vipGone.tab);
  check('vip-module-settings-row-gone', !vipGone.deleteAll);
  // The car-level VIP flag must survive the removal — asserted further down,
  // in the event-scope block, because the chips are rendered from data and
  // this page has none. Checking for the chip here would pass on an empty
  // container, which is how a dead check looks alive.

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

  // Arriving is the only thing the gate does now. Not one car was ever checked
  // out — `left_at` was null on every row that ever existed — and the third
  // state was a button everyone had to read past.
  const gateAfter = await page.evaluate(() => ({
    checkoutBtn: !!document.querySelector('[data-gate-checkout]'),
    // The row it belongs to is the one we just checked in.
    arrivedIsTerminal: !!document.querySelector('.gate-car.arrived .gate-arrive.is-in[disabled]'),
    // One entrance: the per-device gate name is gone. It was never once set.
    gateLabel: !!document.getElementById('gateLabelBtn'),
    // Burst mode lives on the scanner panel.
    burstToggle: !!document.getElementById('gateBurst'),
    burstFlash: !!document.getElementById('gateBurstFlash'),
  }));
  check('gate-has-no-checkout', !gateAfter.checkoutBtn);
  check('gate-arrived-is-terminal', gateAfter.arrivedIsTerminal);
  check('gate-has-no-gate-name', !gateAfter.gateLabel);
  check('gate-burst-toggle-present', gateAfter.burstToggle && gateAfter.burstFlash);

  // Burst is a per-device habit: it has to survive closing the scanner.
  const burstPersist = await page.evaluate(() => {
    const b = document.getElementById('gateBurst');
    if (!b) return null;
    b.checked = true;
    b.dispatchEvent(new Event('change'));
    return localStorage.getItem('kultura_gate_burst');
  });
  check('gate-burst-remembers-choice', burstPersist === '1');
  await page.evaluate(() => {
    const b = document.getElementById('gateBurst');
    if (b) { b.checked = false; b.dispatchEvent(new Event('change')); }
  });

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

      // The zone was two clicks and a placeholder sentence away from a list of
      // nine, and the list itself was unreadable: the OS drew the popup white
      // while the options inherited the near-white --text off the select.
      const zone = await bp.evaluate(() => {
        const sel = document.getElementById('carZoneInput');
        const opt = sel && sel.options[1];
        const cs = opt ? getComputedStyle(opt) : null;
        return {
          hasSelect: !!sel,
          hasEditBtn: !!document.getElementById('carEditZoneBtn'),
          options: sel ? sel.options.length : 0,
          optBg: cs ? cs.backgroundColor : '',
          optFg: cs ? cs.color : '',
          rootScheme: getComputedStyle(document.documentElement).colorScheme,
        };
      });
      check('carzone-select-shown-directly', zone.hasSelect && !zone.hasEditBtn);
      // Placeholder + the nine parking zones.
      check('carzone-lists-all-zones', zone.options === 10);
      // The exact failure that made the list look empty. Note the condition:
      // an option with NO background of its own computes to rgba(0,0,0,0) and
      // lets the OS popup's white through under near-white text. Comparing the
      // two colours is not enough — transparent differs from white, so the
      // first version of this check passed with the fix deliberately removed.
      // What matters is that the option paints its own opaque background.
      const opaque = /^rgb\(/.test(zone.optBg);
      check('carzone-options-readable', opaque && zone.optBg !== zone.optFg);
      // Root cause: no scheme meant the OS chose a light popup under dark text.
      check('native-popups-follow-dark-scheme', zone.rootScheme === 'dark');
    } catch (e) {
      for (const n of ['block-hydrates-from-cache', 'block-card-flagged', 'block-clean-car-unflagged',
        'block-reason-in-tooltip', 'block-detail-warns', 'block-detail-shows-reason', 'block-detail-badge',
        'carzone-select-shown-directly', 'carzone-lists-all-zones', 'carzone-options-readable',
        'native-popups-follow-dark-scheme']) {
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
    for (const name of ['index', 'register', 'vote', 'agenda', 'feedback', 'ticket', 'confirmed', 'privacy', 'plan']) {
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
    for (const name of ['index', 'register', 'vote', 'agenda', 'feedback', 'plan']) {
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
          vipChip: !!document.querySelector('#carsChips [data-cars-filter="vip"]'),
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
      // Removing the VIP-guests module must not take the VIP flag on a car with
      // it: the chip is the only way to pull that list up at the gate.
      check('vip-car-flag-kept', on6.vipChip);

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
        'scope-public-link-carries-event', 'scope-counts-update-on-switch',
        'vip-car-flag-kept']) {
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
      // `app_config` has RLS on with no policies: a signed-in client gets an
      // empty list, not an error. Modelling that is the whole point — the first
      // version of this panel read the bot token straight from here and quietly
      // got nothing, and a mock that returned rows hid it.
      if (u.includes('/rest/v1/app_config')) return J([]);
      if (u.includes('/rest/v1/ui_settings')) return J([{ key: 'notify_prefer_telegram', value: '1' }, { key: 'public_base_url', value: 'https://kultura.example' }]);
      if (u.includes('/functions/v1/telegram')) {
        return J({ ok: true, has_token: true, username: 'kultura_test_bot', webhook: 'https://x/functions/v1/telegram', linked: 4 });
      }
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
        tokenPlaceholder: document.getElementById('tgToken').placeholder,
        tgMsg: document.getElementById('tgMsg').textContent,
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
      // Everything the panel knows about the bot has to come from the edge
      // function, because app_config is unreachable from the browser.
      check('telegram-state-comes-from-function', /kultura_test_bot/.test(s.tgMsg) && /4/.test(s.tgMsg));
      check('telegram-token-marked-stored', /salvat/i.test(s.tokenPlaceholder));
    } catch (e) {
      for (const n of ['rsvp-badges-on-cards', 'trash-panel-visible-to-admin', 'trash-lists-deleted-car',
        'trash-offers-restore', 'trash-entry-badge-not-stretched', 'imports-listed',
        'import-undo-only-for-live-batch', 'telegram-panel-visible-to-admin',
        'telegram-token-never-echoed', 'public-base-url-loaded',
        'telegram-state-comes-from-function', 'telegram-token-marked-stored']) {
        if (!checks.some((c) => c.name === n)) check(n, false);
      }
      console.log(`trash/telegram checks: ${e.message}`);
    }
    await tctx.close();
  }

  // 4ka. The registration queue has two neighbouring buttons — hold and
  // waitlist — and only one of them survived a reload. `loadData()` asked for
  // status in ('pending','hold'), so a registration moved to the waitlist was
  // written, acknowledged with a toast, rendered into its own tab, and then
  // gone the next time the app started. The realtime handler dropped it too.
  //
  // The mock here honours `status=in.(...)` the way PostgREST does, instead of
  // answering every query with the same array. That is the whole point: a mock
  // that ignores the filter cannot tell a correct query from a broken one, and
  // would have reported this defect as working.
  {
    const REGS = [
      { id: 21, brand: 'R', model: 'Pending', owner: 'o', plate: 'Q1', status: 'pending', event_id: 6, photos: [], created_at: new Date().toISOString() },
      { id: 22, brand: 'R', model: 'Hold', owner: 'o', plate: 'Q2', status: 'hold', event_id: 6, photos: [], created_at: new Date().toISOString() },
      { id: 23, brand: 'R', model: 'Wait', owner: 'o', plate: 'Q3', status: 'waitlist', event_id: 6, photos: [], created_at: new Date().toISOString() },
    ];
    const rctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    await rctx.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url();
      const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (u.includes('/rest/v1/car_registrations')) {
        // Mirror PostgREST: only hand back the statuses actually asked for.
        const m = decodeURIComponent(u).match(/status=in\.\(([^)]*)\)/);
        const want = m ? m[1].split(',').map((x) => x.replace(/"/g, '').trim()) : null;
        return J(want ? REGS.filter((x) => want.includes(x.status)) : REGS);
      }
      if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'Ev', status: 'planned', event_date: new Date(Date.now() + 864e5).toISOString().slice(0, 10) }]);
      if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
      if (u.includes('/rest/v1/')) return J([]);
      if (u.includes('/functions/v1/')) return J({});
      return r.abort();
    });
    const rp = await rctx.newPage();
    await rp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await rp.evaluate(() => {
      localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      }));
    });
    await rp.reload({ waitUntil: 'domcontentloaded' });
    await rp.waitForSelector('#regQueue .chip', { state: 'attached', timeout: 12000 }).catch(() => {});
    await rp.waitForTimeout(1200);
    try {
      const q = await rp.evaluate(() => {
        const n = (k) => {
          const c = document.querySelector(`#regQueue [data-reg-filter="${k}"] .count`);
          return c ? Number((c.textContent.match(/(\d+)/) || [])[1]) : null;
        };
        const labels = [...document.querySelectorAll('#regQueue [data-reg-filter]')]
          .map((b) => b.textContent.replace(/\s+/g, ' ').replace(/·.*/, '').trim());
        return {
          pending: n('pending'), hold: n('hold'), waitlist: n('waitlist'),
          labels,
          holdBtn: (document.getElementById('regDetailHold')?.textContent || '').trim(),
          waitBtn: (document.getElementById('regDetailWaitlist')?.textContent || '').trim(),
        };
      });
      check('regqueue-pending-loaded', q.pending === 1);
      check('regqueue-hold-loaded', q.hold === 1);
      // The bug: this tab never appeared, because the row was never fetched.
      check('regqueue-waitlist-survives-reload', q.waitlist === 1);
      // The two tabs read identically in Romanian before this: both "În așteptare".
      check('regqueue-tab-labels-distinct', new Set(q.labels).size === q.labels.length);
      // Same for the two buttons sitting next to each other in the modal.
      check('regqueue-action-buttons-distinct',
        !!q.holdBtn && !!q.waitBtn && q.holdBtn !== q.waitBtn);
    } catch (e) {
      for (const n of ['regqueue-pending-loaded', 'regqueue-hold-loaded',
        'regqueue-waitlist-survives-reload', 'regqueue-tab-labels-distinct',
        'regqueue-action-buttons-distinct']) {
        if (!checks.some((c2) => c2.name === n)) check(n, false);
      }
      console.log(`reg queue checks: ${e.message}`);
    }
    await rctx.close();
  }

  // 4kb. Sending a driver the bot connect link. The driver is by definition NOT
  // on Telegram yet — that is what the link is for — so the bot cannot deliver
  // it and SMS has no provider configured. WhatsApp is the one channel that
  // actually works, which is also how the app already contacts drivers.
  //
  // The click is exercised for real because the ordering is the fragile part:
  // minting the link is a round trip, and a window opened after an await is
  // treated as a popup and blocked. Asserting on markup alone would miss that.
  {
    const CARS = [
      { id: 1, entry_no: 1, brand: 'Dacia', model: 'Logan', owner: 'Ion Popa', plate: 'P1', phone: '069123456', status: 'Invitat', event_id: 6, telegram_chat_id: null, deleted_at: null },
      { id: 2, entry_no: 2, brand: 'BMW', model: 'M3', owner: 'Fara Telefon', plate: 'P2', phone: '', status: 'Invitat', event_id: 6, telegram_chat_id: null, deleted_at: null },
    ];
    const LINK = 'https://t.me/KulturaEventBot?start=1-abcdef0123456789abcdef01';
    const MINT_MS = 1500;
    const ictx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    // Catch the hand-off instead of letting it out to the real wa.me: the run
    // stays hermetic, and the popup gets a URL we can read back.
    await ictx.route('**://wa.me/**', (r) =>
      r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>wa</body></html>' }));
    await ictx.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url();
      const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      // Deliberately slow. Headless Chromium does not enforce the popup
      // blocker, so ordering cannot be observed by whether a window appears —
      // only by WHEN. With the window opened first it shows up immediately;
      // opened after the mint it cannot appear before this delay elapses.
      if (u.includes('/functions/v1/telegram')) {
        return new Promise((res) => setTimeout(
          () => res(J({ ok: true, cars: [{ id: 1, link: LINK, linked: false }] })), MINT_MS));
      }
      if (u.includes('/rest/v1/cars')) return J(/deleted_at=not\.is\.null/.test(u) ? [] : CARS);
      if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'Ev', status: 'planned' }]);
      // Staff, or the button is not rendered at all and every check below is
      // vacuous.
      if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'staff' }]);
      if (u.includes('/rest/v1/')) return J([]);
      if (u.includes('/functions/v1/')) return J({});
      return r.abort();
    });
    const ip = await ictx.newPage();
    await ip.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await ip.evaluate(() => {
      localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      }));
    });
    await ip.reload({ waitUntil: 'domcontentloaded' });
    await ip.waitForSelector('#carsList .car-row', { state: 'attached', timeout: 12000 }).catch(() => {});
    // The rows render while Home is still the visible section, so they are
    // attached but not clickable until we switch tabs.
    await ip.evaluate(() => document.querySelector('.tab[data-section="cars"], .mtab[data-section="cars"]')?.click());
    await ip.waitForTimeout(900);
    try {
      // Car with a phone: the button must offer to send, not to copy.
      await ip.locator('[data-row-id="1"] .row-title').click();
      await ip.waitForSelector('[data-detail-action="car-invite-tg"]', { state: 'attached', timeout: 5000 });
      const withPhone = (await ip.locator('[data-detail-action="car-invite-tg"]').innerText()).trim();
      check('invite-btn-offers-to-send-when-phone', /trimite/i.test(withPhone));

      const t0 = Date.now();
      const [popup] = await Promise.all([
        ip.waitForEvent('popup', { timeout: 8000 }),
        ip.locator('[data-detail-action="car-invite-tg"]').click(),
      ]);
      const openedAfter = Date.now() - t0;
      // The real bug this guards: a window opened after the round trip is a
      // popup, and mobile Safari kills it without a word.
      check('invite-window-opens-before-the-round-trip', openedAfter < MINT_MS);
      // The window is opened blank first and pointed at wa.me after the link
      // is minted, so wait for that second navigation rather than the open.
      await popup.waitForURL(/wa\.me/, { timeout: 8000 }).catch(() => {});
      const wa = decodeURIComponent(popup.url());
      // A window opened after the await would never have reached wa.me.
      check('invite-opens-whatsapp-to-the-driver', wa.includes('wa.me/') && wa.includes('37369123456'));
      // The point of the whole button: the connect link has to be in the text.
      check('invite-message-carries-the-connect-link', wa.includes(LINK));
      await popup.close();
      await ip.evaluate(() => document.querySelector('#modal-car-detail')?.classList.remove('show'));
      await ip.waitForTimeout(500);

      // No phone: nothing to send to, so the label must say copy instead.
      // Wait for the modal to actually be showing THIS car — reading the button
      // too early gets the previous car's label and quietly passes.
      await ip.locator('[data-row-id="2"] .row-title').click();
      await ip.waitForFunction(
        () => (document.getElementById('carDetailBody')?.textContent || '').includes('P2'),
        null, { timeout: 8000 });
      const noPhone = (await ip.locator('[data-detail-action="car-invite-tg"]').innerText()).trim();
      check('invite-btn-falls-back-to-copy-without-phone',
        !/trimite/i.test(noPhone) && noPhone.length > 0);
    } catch (e) {
      for (const n of ['invite-btn-offers-to-send-when-phone', 'invite-window-opens-before-the-round-trip',
        'invite-opens-whatsapp-to-the-driver',
        'invite-message-carries-the-connect-link', 'invite-btn-falls-back-to-copy-without-phone']) {
        if (!checks.some((c2) => c2.name === n)) check(n, false);
      }
      console.log(`invite checks: ${e.message}`);
    }
    await ictx.close();
  }

  // 4kc. A car cannot be approved without a zone, and the people who cannot be
  // reached are listed where somebody can act on them.
  //
  // Both come from the same measurement: 47 of 52 approved cars had no zone and
  // the zone had been set by hand 17 times in the life of the app, while 1 of
  // 52 participants was reachable on Telegram. Neither number was attached to
  // anything a person could press.
  {
    const REGS = [
      { id: 31, brand: 'Honda', model: 'S2000', owner: 'Ana', plate: 'Z1', phone: '069111222', status: 'pending', event_id: 6, category: 'JDM', photos: [], created_at: new Date().toISOString() },
    ];
    const CARS = [
      { id: 1, entry_no: 1, brand: 'VW', model: 'Golf', owner: 'Ion', plate: 'C1', phone: '069123456', status: 'Invitat', event_id: 6, telegram_chat_id: null, deleted_at: null },
      { id: 2, entry_no: 2, brand: 'Audi', model: 'S4', owner: 'Maria', plate: 'C2', phone: '069222333', status: 'Invitat', event_id: 6, telegram_chat_id: 555, deleted_at: null },
    ];
    const zctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    await zctx.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url();
      const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (u.includes('/rest/v1/car_registrations')) return J(REGS);
      if (u.includes('/rest/v1/cars')) return J(/deleted_at=not\.is\.null/.test(u) ? [] : CARS);
      if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'Ev', status: 'Activ', starts_at: new Date(Date.now() + 864e5).toISOString() }]);
      if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
      if (u.includes('/rest/v1/')) return J([]);
      if (u.includes('/functions/v1/')) return J({});
      return r.abort();
    });
    const zp = await zctx.newPage();
    await zp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await zp.evaluate(() => {
      localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      }));
    });
    await zp.reload({ waitUntil: 'domcontentloaded' });
    await zp.waitForTimeout(1600);
    await zp.evaluate(() => document.getElementById('splashScreen')?.remove());
    try {
      await zp.evaluate(() => document.querySelector('.tab[data-section="cars"], .mtab[data-section="cars"]')?.click());
      await zp.waitForSelector('#regQueue .reg-card', { state: 'visible', timeout: 8000 });
      await zp.locator('#regQueue .reg-card').first().click();
      await zp.waitForSelector('#regDetailZone', { state: 'visible', timeout: 5000 });

      // Approve with the zone still on the placeholder: it must refuse, say
      // why, and leave the modal open so the answer can be given.
      await zp.locator('#regDetailApprove').click();
      await zp.waitForTimeout(400);
      const refused = await zp.evaluate(() => ({
        modalOpen: !!document.querySelector('#modal-reg-detail.show'),
        warned: !document.getElementById('regZoneWarn')?.hidden,
        marked: !!document.querySelector('#regDetailZone.is-missing'),
        text: (document.getElementById('regZoneWarn')?.textContent || '').trim(),
      }));
      check('approve-refused-without-zone', refused.modalOpen && refused.warned, JSON.stringify(refused));
      check('approve-says-why-zone-is-needed', /zon/i.test(refused.text) && refused.marked);

      // Choosing one clears the complaint straight away.
      await zp.selectOption('#regDetailZone', 'JDM');
      await zp.waitForTimeout(250);
      const cleared = await zp.evaluate(() => ({
        warned: !document.getElementById('regZoneWarn')?.hidden,
        marked: !!document.querySelector('#regDetailZone.is-missing'),
      }));
      check('approve-warning-clears-on-choice', !cleared.warned && !cleared.marked);

      await zp.evaluate(() => document.querySelector('#modal-reg-detail')?.classList.remove('show'));

      // The funnel: two cars, one linked, so it must name the other one and
      // offer to send.
      await zp.evaluate(() => document.querySelector('.tab[data-section="settings"], .mtab[data-section="settings"]')?.click());
      await zp.waitForTimeout(1200);
      const funnel = await zp.evaluate(() => {
        const box = document.getElementById('tgFunnel');
        return {
          hidden: box?.hidden !== false,
          head: (box?.querySelector('.tg-funnel-head')?.textContent || '').trim(),
          rows: [...(box?.querySelectorAll('.tg-funnel-row') || [])].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
          sendable: (box?.querySelectorAll('[data-tg-invite]') || []).length,
        };
      });
      check('funnel-visible-when-someone-unreachable', !funnel.hidden);
      check('funnel-counts-linked-out-of-total', /1.*2/.test(funnel.head), funnel.head);
      // Only the unlinked car — listing the connected one would be noise.
      check('funnel-lists-only-the-unreachable',
        funnel.rows.length === 1 && /Ion|Golf/.test(funnel.rows[0]), JSON.stringify(funnel.rows));
      check('funnel-offers-a-send-button', funnel.sendable === 1);
    } catch (e) {
      for (const n of ['approve-refused-without-zone', 'approve-says-why-zone-is-needed',
        'approve-warning-clears-on-choice', 'funnel-visible-when-someone-unreachable',
        'funnel-counts-linked-out-of-total', 'funnel-lists-only-the-unreachable',
        'funnel-offers-a-send-button']) {
        if (!checks.some((c2) => c2.name === n)) check(n, false);
      }
      console.log(`zone/funnel checks: ${e.message}`);
    }
    await zctx.close();
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

  // 4m. The ticket page is the only route by which a participant ever links
  // their Telegram chat — a bot cannot message someone who has not opened it
  // first. The feature shipped once with no way to hand the link out at all,
  // so this guards the path rather than the plumbing.
  {
    // Only the participant who still has to connect gets anything here. Once
    // linked there is nothing to do, and the ticket is read at a gate: every
    // block that is not the QR code pushes it further down the screen.
    for (const [label, extra, wantLink] of [
      ['fresh', { tg_link: 'https://t.me/KulturaEventBot?start=42-abc', tg_linked: false }, true],
      ['linked', { tg_link: 'https://t.me/KulturaEventBot?start=42-abc', tg_linked: true }, false],
      ['nobot', { tg_link: '', tg_linked: false }, false],
    ]) {
      const tkctx = await browser.newContext({ viewport: { width: 430, height: 930 } });
      await tkctx.route('**://*.supabase.co/**', (r) => {
        if (!r.request().url().includes('/functions/v1/ticket')) return r.abort();
        return r.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            id: 42, entry_no: 7, name: 'Ion', brand: 'Nissan', model: 'Silvia',
            plate: 'XYZ 123', zone: 'A2', category: 'JDM', arrived: false,
            event: 'Kultura Fest', qr: 'KULTURA:42:XYZ 123', ...extra,
          }),
        });
      });
      const tkp = await tkctx.newPage();
      try {
        await tkp.goto(`${BASE}/ticket.html?c=42&k=XYZ%20123`, { waitUntil: 'domcontentloaded' });
        await tkp.waitForTimeout(700);
        const v = await tkp.evaluate(() => {
          const a = document.querySelector('.t-tg');
          return {
            // Presence, not just the href: a rendered button with a dead href
            // would still look like an invitation to the participant.
            exists: !!a,
            href: a ? a.getAttribute('href') : '',
            target: a ? a.getAttribute('target') : '',
            h: a ? a.getBoundingClientRect().height : 0,
            // Nothing Telegram-shaped at all: neither the old confirmation
            // block nor its hint line may survive.
            anyTg: /telegram/i.test(document.body.innerText),
          };
        });
        check(`ticket-${label}-telegram-button`, v.exists === wantLink && (v.href.length > 0) === wantLink);
        check(`ticket-${label}-telegram-only-when-useful`, v.anyTg === wantLink);
        if (wantLink) {
          check('ticket-telegram-link-is-deep-link', /^https:\/\/t\.me\/\w+\?start=42-/.test(v.href));
          // A finger target, not a text link — this is the whole conversion step.
          check('ticket-telegram-button-tappable', v.h >= 44 && v.target === '_blank');
        }
      } catch (e) {
        console.log(`ticket ${label}: ${e.message}`);
        for (const n of [`ticket-${label}-telegram-button`, `ticket-${label}-telegram-only-when-useful`]) {
          if (!checks.some((c) => c.name === n)) check(n, false);
        }
      }
      await tkctx.close();
    }
    // The known accessibility exception is gone: no page may block pinch-zoom.
    const vp = await browser.newContext().then(async (c) => {
      const p = await c.newPage();
      await p.goto(`${BASE}/ticket.html`, { waitUntil: 'domcontentloaded' });
      const content = await p.evaluate(() =>
        document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '');
      await c.close();
      return content;
    });
    check('ticket-allows-pinch-zoom', !/user-scalable\s*=\s*no/i.test(vp) && !/maximum-scale/i.test(vp));
  }

  // 4n. Readiness list, channel health and the offline bar. All three exist
  // because silence looked identical to success: an empty agenda, a bot with
  // nobody linked, and no sign at all that you were working offline outside
  // the gate screen.
  {
    const mk = async (health, cars, event, agenda = []) => {
      const c = await browser.newContext({ viewport: { width: 430, height: 930 }, isMobile: true, hasTouch: true });
      await c.route('**://*.supabase.co/**', (r) => {
        const u = r.request().url();
        const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
        if (u.includes('/functions/v1/health')) return J(health);
        if (u.includes('/functions/v1/telegram')) return J({ ok: true, has_token: true, username: 'Bot', webhook: 'x', linked: 0 });
        if (u.includes('/rest/v1/cars')) return J(/deleted_at=not\.is\.null/.test(u) ? [] : cars);
        if (u.includes('/rest/v1/event_agenda')) return J(agenda);
        if (u.includes('/rest/v1/events')) return J([event]);
        if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
        if (u.includes('/rest/v1/')) return J([]);
        return r.abort();
      });
      const p = await c.newPage();
      await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await p.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      })));
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(2400);
      await p.evaluate(() => document.getElementById('splashScreen')?.remove());
      return { c, p };
    };

    const HEALTHY = {
      ok: true,
      telegram: { configured: true, username: 'Bot', webhook_live: true, linked: 3, total: 3, preferred: true },
      sms: { configured: true, provider: 'x' }, public_base_url: 'https://k.example',
    };
    const SILENT = {
      ok: true,
      telegram: { configured: true, username: 'Bot', webhook_live: true, linked: 0, total: 2, preferred: true },
      sms: { configured: false, provider: '' }, public_base_url: '',
    };
    const SOON = new Date(Date.now() + 3 * 86400e3).toISOString();
    const PAST = new Date(Date.now() - 14 * 86400e3).toISOString();
    // A real start date is part of being ready: without it the reminders, the
    // countdown and the confirmation window all skip the event in silence.
    const READY_EVENT = { id: 6, title: 'F', status: 'Activ', archived: false, entries_frozen: true, is_sandbox: false, reg_capacity: 40, starts_at: SOON };
    const RAW_EVENT = { id: 6, title: 'F', status: 'Activ', archived: false, entries_frozen: false, is_sandbox: false, reg_capacity: null };
    const OVER_EVENT = { ...READY_EVENT, starts_at: PAST, ends_at: PAST };
    const CARS = [
      { id: 1, entry_no: 1, brand: 'VW', model: 'Golf', owner: 'A', plate: 'P1', status: 'Sosit', event_id: 6, zone: '', deleted_at: null },
      { id: 2, entry_no: 2, brand: 'Mazda', model: 'RX7', owner: 'B', plate: 'P2', status: 'Sosit', event_id: 6, zone: 'A1', deleted_at: null },
    ];

    try {
      // Everything unfinished: the list names each gap.
      const a = await mk(SILENT, CARS, RAW_EVENT);
      await a.p.waitForTimeout(700);
      const rows = await a.p.evaluate(() =>
        [...document.querySelectorAll('#readyList .ready-row')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
      check('ready-list-shows-gaps', rows.length >= 5, `${rows.length} rows`);
      check('ready-list-names-empty-agenda', rows.some(r => /[Pp]rogram/.test(r)));
      check('ready-list-counts-missing-zones', rows.some(r => /1 din 2/.test(r)));
      check('ready-list-flags-unfrozen-list', rows.some(r => /îngheț/i.test(r)));
      // RAW_EVENT deliberately has no starts_at. `date` is free text, so this
      // is the only field that can answer "when", and nothing used to say it
      // was missing.
      check('ready-list-flags-missing-start-date', rows.some(r => /dat[ăa] real/i.test(r)));

      await a.p.evaluate(() => document.querySelector('.mtab[data-section="settings"], .tab[data-section="settings"]')?.click());
      await a.p.waitForTimeout(1000);
      const pills = await a.p.evaluate(() =>
        [...document.querySelectorAll('#channelHealth .chan-pill')].map(x => ({
          state: x.className.replace('chan-pill ', ''), text: x.textContent.trim(),
        })));
      check('channel-health-has-three-pills', pills.length === 3, `${pills.length}`);
      // Configured but nobody listening is amber, not green — that exact state
      // shipped once and looked fine.
      check('channel-health-warns-on-zero-linked',
        pills.some(p => /Telegram/.test(p.text) && p.state === 'is-warn'), JSON.stringify(pills[0] || {}));
      check('channel-health-flags-missing-base-url',
        pills.some(p => /public|Adres/i.test(p.text) && p.state === 'is-bad'));

      // Offline: the bar has to appear away from the gate screen.
      await a.p.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
        window.dispatchEvent(new Event('offline'));
      });
      await a.p.waitForTimeout(500);
      const bar = await a.p.evaluate(() => {
        const b = document.getElementById('offlineBar');
        return { hidden: b.hidden, cls: b.className, txt: b.textContent.trim() };
      });
      check('offline-bar-shows-when-offline', !bar.hidden && /is-offline/.test(bar.cls), bar.cls);
      check('offline-bar-says-saved-locally', bar.txt.length > 0);
      await a.c.close();

      // Nothing missing: the list must vanish rather than sit there empty.
      const b = await mk(HEALTHY, CARS.map(c => ({ ...c, zone: 'A1' })), READY_EVENT,
        [{ id: 1, event_id: 6, at_time: '10:00', title: 'Sosiri', notes: '' }]);
      await b.p.waitForTimeout(900);
      const hidden = await b.p.evaluate(() => document.getElementById('readyList').hidden);
      check('ready-list-hides-when-nothing-missing', hidden === true);
      const okPills = await b.p.evaluate(() => {
        document.querySelector('.mtab[data-section="settings"], .tab[data-section="settings"]')?.click();
        return null;
      });
      await b.p.waitForTimeout(900);
      const green = await b.p.evaluate(() =>
        [...document.querySelectorAll('#channelHealth .chan-pill')].every(x => x.classList.contains('is-ok')));
      check('channel-health-all-green-when-configured', green === true, String(okPills));
      await b.c.close();

      // An event two weeks past its end, still marked Activ — the state the
      // live event has been in. Everything else about it is complete, so this
      // row is the only thing the list can be reacting to.
      const d = await mk(HEALTHY, CARS.map(c => ({ ...c, zone: 'A1' })), OVER_EVENT,
        [{ id: 1, event_id: 6, at_time: '10:00', title: 'Sosiri', notes: '' }]);
      await d.p.waitForTimeout(900);
      const overRows = await d.p.evaluate(() =>
        [...document.querySelectorAll('#readyList .ready-row')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
      check('ready-list-flags-finished-event', overRows.some(r => /încheiat/i.test(r)), overRows.join(' | '));
      await d.c.close();
    } catch (e) {
      for (const n of ['ready-list-shows-gaps', 'ready-list-names-empty-agenda',
        'ready-list-counts-missing-zones', 'ready-list-flags-unfrozen-list',
        'channel-health-has-three-pills', 'channel-health-warns-on-zero-linked',
        'channel-health-flags-missing-base-url', 'offline-bar-shows-when-offline',
        'offline-bar-says-saved-locally', 'ready-list-hides-when-nothing-missing',
        'channel-health-all-green-when-configured',
        'ready-list-flags-missing-start-date', 'ready-list-flags-finished-event']) {
        if (!checks.some((c) => c.name === n)) check(n, false);
      }
      console.log(`readiness/health checks: ${e.message}`);
    }
  }

  // 4o. Campaign recipients must be able to reach Telegram. The list used to be
  // keyed by phone number and carried no car id, so a campaign could never use
  // the bot — and anyone reachable only on Telegram was dropped outright.
  {
    const CARS = [
      // No phone at all, but a linked chat: previously invisible to a campaign.
      { id: 1, entry_no: 1, brand: 'VW', model: 'Golf', owner: 'Ana Pop', plate: 'P1', status: 'Sosit', event_id: 6, phone: null, contact: null, telegram_chat_id: 111, deleted_at: null },
      // Phone only: still reachable, by SMS.
      { id: 2, entry_no: 2, brand: 'Mazda', model: 'RX7', owner: 'Ion Rus', plate: 'P2', status: 'Sosit', event_id: 6, phone: '+37360000002', contact: null, telegram_chat_id: null, deleted_at: null },
      // Neither: genuinely unreachable, must not be counted.
      { id: 3, entry_no: 3, brand: 'BMW', model: 'E30', owner: 'Fara Contact', plate: 'P3', status: 'Sosit', event_id: 6, phone: null, contact: null, telegram_chat_id: null, deleted_at: null },
    ];
    const sctx = await browser.newContext({ viewport: { width: 430, height: 930 }, isMobile: true, hasTouch: true });
    await sctx.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url();
      const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (u.includes('/functions/v1/health')) {
        return J({ ok: true, telegram: { configured: true, username: 'B', webhook_live: true, linked: 1, total: 3, preferred: true }, sms: { configured: true, provider: 'x' }, public_base_url: 'https://k.example' });
      }
      if (u.includes('/functions/v1/')) return J({ ok: true });
      if (u.includes('/rest/v1/cars')) return J(/deleted_at=not\.is\.null/.test(u) ? [] : CARS);
      if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'F', status: 'Activ', archived: false, entries_frozen: false, is_sandbox: false }]);
      if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
      if (u.includes('/rest/v1/')) return J([]);
      return r.abort();
    });
    const sp = await sctx.newPage();
    try {
      await sp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await sp.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      })));
      await sp.reload({ waitUntil: 'domcontentloaded' });
      await sp.waitForTimeout(2400);
      await sp.evaluate(() => {
        document.getElementById('splashScreen')?.remove();
        document.querySelector('.mtab[data-section="sms"], .tab[data-section="sms"]')?.click();
      });
      await sp.waitForTimeout(500);
      // Nudge the audience so the count recomputes.
      await sp.evaluate(() => {
        const cb = document.querySelector('#smsAudience input[data-sms-aud="all"]');
        cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await sp.waitForTimeout(400);
      const txt = await sp.evaluate(() => document.getElementById('smsRecipientCount').textContent);
      // Two reachable of three; the one with neither channel is left out.
      check('campaign-counts-only-reachable', /\b2\b/.test(txt) && !/\b3\b/.test(txt), txt);
      check('campaign-shows-channel-split', /1/.test(txt) && /Telegram/i.test(txt), txt);
    } catch (e) {
      for (const n of ['campaign-counts-only-reachable', 'campaign-shows-channel-split']) {
        if (!checks.some((c) => c.name === n)) check(n, false);
      }
      console.log(`campaign checks: ${e.message}`);
    }
    await sctx.close();
  }

  // 4oa. A campaign has to say who it can actually reach, before it is sent.
  //
  // From production: 52 recipients, 1 delivered, 51 failed with no_provider,
  // and the row filed as status "sent" — green in the history, identical to a
  // campaign that really went out. Every one of those 52 had a phone number; a
  // phone number is not a channel when no SMS provider exists.
  {
    const mk = async (smsConfigured, cars) => {
      const c = await browser.newContext({ viewport: { width: 430, height: 930 }, isMobile: true, hasTouch: true });
      await c.route('**://*.supabase.co/**', (r) => {
        const u = r.request().url();
        const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
        if (u.includes('/functions/v1/health')) {
          return J({ ok: true, telegram: { configured: true, username: 'B', webhook_live: true, linked: 1, total: cars.length, preferred: true },
            sms: { configured: smsConfigured, provider: smsConfigured ? 'x' : '' }, public_base_url: 'https://k.example' });
        }
        if (u.includes('/functions/v1/')) return J({ ok: true });
        if (u.includes('/rest/v1/cars')) return J(/deleted_at=not\.is\.null/.test(u) ? [] : cars);
        if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'F', status: 'Activ', archived: false, entries_frozen: false, is_sandbox: false }]);
        if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
        if (u.includes('/rest/v1/')) return J([]);
        return r.abort();
      });
      const p = await c.newPage();
      await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await p.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      })));
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(2400);
      await p.evaluate(() => {
        document.getElementById('splashScreen')?.remove();
        document.querySelector('.mtab[data-section="sms"], .tab[data-section="sms"]')?.click();
        const cb = document.querySelector('#smsAudience input[data-sms-aud="all"]');
        if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        const m = document.getElementById('smsMessage');
        if (m) { m.value = 'Salut'; m.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      await p.waitForTimeout(500);
      return { c, p };
    };
    // One on Telegram, two with a phone only — the production shape in miniature.
    const MIXED = [
      { id: 1, entry_no: 1, brand: 'VW', model: 'Golf', owner: 'Ana', plate: 'P1', status: 'Invitat', event_id: 6, phone: '+37360000001', telegram_chat_id: 111, deleted_at: null },
      { id: 2, entry_no: 2, brand: 'Mazda', model: 'RX7', owner: 'Ion', plate: 'P2', status: 'Invitat', event_id: 6, phone: '+37360000002', telegram_chat_id: null, deleted_at: null },
      { id: 3, entry_no: 3, brand: 'BMW', model: 'E30', owner: 'Dan', plate: 'P3', status: 'Invitat', event_id: 6, phone: '+37360000003', telegram_chat_id: null, deleted_at: null },
    ];
    try {
      // No SMS provider: only the linked chat can be reached.
      const a = await mk(false, MIXED);
      await a.p.evaluate(() => document.getElementById('smsSendBtn')?.click());
      await a.p.waitForTimeout(600);
      const warn = await a.p.evaluate(() => ({
        open: !!document.querySelector('.ui-dialog.show, #uiDialog.show'),
        text: (document.getElementById('uiDialogMessage')?.textContent || ''),
      }));
      // It must name both halves: who gets it, and who silently would not.
      check('campaign-warns-before-sending', warn.open, JSON.stringify(warn));
      check('campaign-warning-names-the-split',
        /\b1\b/.test(warn.text) && /\b2\b/.test(warn.text), warn.text);
      await a.p.evaluate(() => document.getElementById('uiDialogCancel')?.click());
      await a.c.close();

      // Nobody reachable at all: refuse outright rather than ask.
      const NOBODY = MIXED.map((c) => ({ ...c, telegram_chat_id: null }));
      const b = await mk(false, NOBODY);
      await b.p.evaluate(() => document.getElementById('smsSendBtn')?.click());
      await b.p.waitForTimeout(600);
      const stop = await b.p.evaluate(() => ({
        dialog: !!document.querySelector('.ui-dialog.show, #uiDialog.show'),
        msg: (document.getElementById('smsSendMsg')?.textContent || ''),
      }));
      check('campaign-refuses-when-nobody-reachable', !stop.dialog && stop.msg.length > 0, JSON.stringify(stop));
      check('campaign-refusal-points-at-the-fix', /Telegram/i.test(stop.msg), stop.msg);
      await b.c.close();

      // With a provider configured, everyone is reachable and it just asks.
      const d = await mk(true, MIXED);
      await d.p.evaluate(() => document.getElementById('smsSendBtn')?.click());
      await d.p.waitForTimeout(600);
      const plain = await d.p.evaluate(() => (document.getElementById('uiDialogMessage')?.textContent || ''));
      check('campaign-no-warning-when-all-reachable', /\b3\b/.test(plain) && !/\b2\b/.test(plain), plain);
      await d.p.evaluate(() => document.getElementById('uiDialogCancel')?.click());
      await d.c.close();
    } catch (e) {
      for (const n of ['campaign-warns-before-sending', 'campaign-warning-names-the-split',
        'campaign-refuses-when-nobody-reachable', 'campaign-refusal-points-at-the-fix',
        'campaign-no-warning-when-all-reachable']) {
        if (!checks.some((c2) => c2.name === n)) check(n, false);
      }
      console.log(`campaign reach checks: ${e.message}`);
    }
  }

  // 4p. Numbered parking spots drawn on the venue photo.
  //
  // The zone answered "roughly where"; with 52 cars in one field that stopped
  // being enough. A spot is a number placed on the map, and the pin carries the
  // car sitting on it — which is the whole reason for putting the plan on the
  // picture instead of in a list.
  {
    const CARS = [
      // On a spot and already here: the pin must read as arrived.
      { id: 1, entry_no: 11, brand: 'VW', model: 'Golf', owner: 'Ana', plate: 'P1', status: 'Sosit', zone: 'Stance', spot_no: 1, event_id: 6, deleted_at: null },
      // On a spot but not arrived yet.
      { id: 2, entry_no: 12, brand: 'Mazda', model: 'RX7', owner: 'Ion', plate: 'P2', status: 'Invitat', zone: 'Stance', spot_no: 2, event_id: 6, deleted_at: null },
      // Has the zone but no spot — the map must show its spot as free.
      { id: 3, entry_no: 13, brand: 'BMW', model: 'E30', owner: 'Dan', plate: 'P3', status: 'Invitat', zone: 'Stance', spot_no: null, event_id: 6, deleted_at: null },
    ];
    const SPOTS = [
      { zone: 'Stance', no: 1, x: 20, y: 30 },
      { zone: 'Stance', no: 2, x: 50, y: 30 },
      { zone: 'Stance', no: 3, x: 80, y: 30 },
    ];
    let saved = null;
    const mctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
    await mctx.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url(), m = r.request().method();
      const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (u.includes('/rest/v1/ui_settings')) {
        if (m === 'POST') {
          try {
            const b = JSON.parse(r.request().postData() || '{}');
            if (b.key === 'zone_spots') saved = JSON.parse(b.value);
          } catch (_) { /* the assertion below reports it */ }
          return J([]);
        }
        if (u.includes('zone_spots')) return J([{ value: JSON.stringify(SPOTS) }]);
        // Keyed, the way PostgREST answers `select('key,value')`: the map is
        // asked for as one read over both keys, and a row without its key
        // tells the app nothing about which map it just received.
        if (u.includes('zone_map_url')) return J([{ key: 'zone_map_url', value: 'https://map.test/plan.png' }]);
        return J([]);
      }
      if (u.includes('/rest/v1/cars')) return J(/deleted_at=not\.is\.null/.test(u) ? [] : CARS);
      if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'Ev', status: 'Activ', starts_at: new Date(Date.now() + 864e5).toISOString() }]);
      if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
      if (u.includes('/rest/v1/')) return J([]);
      if (u.includes('/functions/v1/')) return J({});
      return r.abort();
    });
    // A real image, so the wrapper has a size and percentages mean something.
    await mctx.route('**://map.test/**', (r) => r.fulfill({
      status: 200, contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#334"/></svg>',
    }));
    const mp = await mctx.newPage();
    try {
      await mp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await mp.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      })));
      await mp.reload({ waitUntil: 'domcontentloaded' });
      await mp.waitForTimeout(2400);
      await mp.evaluate(() => {
        document.getElementById('splashScreen')?.remove();
        document.querySelector('.tab[data-section="map"], .mtab[data-section="map"]')?.click();
      });
      await mp.waitForSelector('.map-spot', { state: 'attached', timeout: 8000 });

      const view = await mp.evaluate(() => {
        const pin = (n) => document.querySelector(`.map-spot[data-spot-no="${n}"]`);
        const read = (n) => {
          const el2 = pin(n);
          return el2 ? {
            cls: el2.className,
            no: el2.querySelector('.ms-no')?.textContent || '',
            car: el2.querySelector('.ms-car')?.textContent || '',
            left: el2.style.left, top: el2.style.top,
          } : null;
        };
        return { count: document.querySelectorAll('.map-spot').length, one: read(1), two: read(2), three: read(3),
          info: document.getElementById('mapSpotInfo')?.textContent || '' };
      });
      check('spots-drawn-on-the-map', view.count === 3, String(view.count));
      // Positions come from percentages so the plan survives any screen size.
      check('spots-positioned-by-percent', view.one.left === '20%' && view.one.top === '30%',
        `${view.one.left},${view.one.top}`);
      // The point of the feature: the pin says who is on it.
      check('spots-occupied-show-the-car', /taken/.test(view.one.cls) && view.one.car === '#11', JSON.stringify(view.one));
      check('spots-keep-the-number-when-taken', view.one.no === '1', view.one.no);
      // Arrived reads differently from expected — that is the glance value.
      check('spots-arrived-marked-apart', /here/.test(view.one.cls) && !/here/.test(view.two.cls),
        `${view.one.cls} | ${view.two.cls}`);
      // A car with the zone but no spot must not colour a spot in.
      check('spots-free-stay-free', !/taken/.test(view.three.cls) && view.three.no === '3', JSON.stringify(view.three));
      check('spots-summary-counts-occupancy', /2/.test(view.info) && /3/.test(view.info), view.info);

      // Placing: pick a zone, turn on edit, tap the photo.
      await mp.selectOption('#spotZone', 'Retro');
      await mp.evaluate(() => document.getElementById('spotEditBtn').click());
      const box = await mp.evaluate(() => {
        const r = document.getElementById('mapImageWrap').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      await mp.mouse.click(box.x + box.w * 0.4, box.y + box.h * 0.8);
      await mp.waitForTimeout(600);
      const added = (saved || []).find((sp) => sp.zone === 'Retro');
      check('spots-placing-writes-config', !!added, JSON.stringify(saved));
      // Numbering restarts per zone: Retro's first spot is 1, not 4.
      check('spots-numbered-per-zone', !!added && added.no === 1, JSON.stringify(added));
      check('spots-placed-where-tapped',
        !!added && Math.abs(added.x - 40) < 3 && Math.abs(added.y - 80) < 3, JSON.stringify(added));
    } catch (e) {
      for (const n of ['spots-drawn-on-the-map', 'spots-positioned-by-percent',
        'spots-occupied-show-the-car', 'spots-keep-the-number-when-taken',
        'spots-arrived-marked-apart', 'spots-free-stay-free',
        'spots-summary-counts-occupancy', 'spots-placing-writes-config',
        'spots-numbered-per-zone', 'spots-placed-where-tapped']) {
        if (!checks.some((c2) => c2.name === n)) check(n, false);
      }
      console.log(`map spot checks: ${e.message}`);
    }
    await mctx.close();
  }

  // 4q. A drawn plan, not a photo with a few pins on it.
  //
  // The venue plan is rows of forty slots. Tapping each one is data entry, and
  // at fit-width a slot is a few pixels across — so the plan is laid a row at a
  // time and read by zooming in. Both halves are what make the map usable at
  // all, which is why they are checked against a dense fixture, not three pins.
  {
    const SPOTS = Array.from({ length: 26 }, (_, i) => ({
      zone: 'Stance', no: i + 1, x: 10 + (80 * i) / 25, y: 12 + (74 * i) / 25,
    }));
    const CARS = [
      { id: 1, entry_no: 11, brand: 'VW', model: 'Golf', owner: 'Ana', plate: 'P1', status: 'Sosit', zone: 'Stance', spot_no: 1, event_id: 6, deleted_at: null },
      { id: 2, entry_no: 12, brand: 'Mazda', model: 'RX7', owner: 'Ion', plate: 'P2', status: 'Invitat', zone: 'Stance', spot_no: 2, event_id: 6, deleted_at: null },
    ];
    let saved = null;
    const carPatches = [];
    const zctx = await browser.newContext({ viewport: { width: 1200, height: 950 } });
    await zctx.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url(), m = r.request().method();
      const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (u.includes('/rest/v1/ui_settings')) {
        if (m === 'POST') {
          try {
            const b = JSON.parse(r.request().postData() || '{}');
            if (b.key === 'zone_spots') saved = JSON.parse(b.value);
          } catch (_) { /* the assertions below report it */ }
          return J([]);
        }
        if (u.includes('zone_spots')) return J([{ value: JSON.stringify(SPOTS) }]);
        // Keyed, the way PostgREST answers `select('key,value')`: the map is
        // asked for as one read over both keys, and a row without its key
        // tells the app nothing about which map it just received.
        if (u.includes('zone_map_url')) return J([{ key: 'zone_map_url', value: 'https://map.test/plan.png' }]);
        return J([]);
      }
      if (u.includes('/rest/v1/cars')) {
        if (m === 'PATCH') { carPatches.push({ url: u, body: r.request().postData() || '' }); return J([]); }
        return J(/deleted_at=not\.is\.null/.test(u) ? [] : CARS);
      }
      if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'Ev', status: 'Activ', starts_at: new Date(Date.now() + 864e5).toISOString() }]);
      if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
      if (u.includes('/rest/v1/')) return J([]);
      if (u.includes('/functions/v1/')) return J({});
      return r.abort();
    });
    await zctx.route('**://map.test/**', (r) => r.fulfill({
      status: 200, contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#2b3245"/></svg>',
    }));
    const zp = await zctx.newPage();
    try {
      await zp.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await zp.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      })));
      await zp.reload({ waitUntil: 'domcontentloaded' });
      await zp.waitForTimeout(2400);
      await zp.evaluate(() => {
        document.getElementById('splashScreen')?.remove();
        document.querySelector('.tab[data-section="map"], .mtab[data-section="map"]')?.click();
      });
      await zp.waitForSelector('.map-spot', { state: 'attached', timeout: 8000 });

      // Twenty-six pins across one photo at fit-width is a smear: the plan
      // falls back to dots, and the cars come back once there is room to read
      // them. Anything else and the overview is unreadable exactly when the
      // zone is full, which is the moment it is needed.
      const dense = await zp.evaluate(() => {
        const layer = document.getElementById('mapSpotLayer');
        const at1 = layer.classList.contains('dense');
        document.getElementById('mapZoomIn').click();
        document.getElementById('mapZoomIn').click();
        return { at1, zoomed: layer.classList.contains('dense') };
      });
      check('spots-dense-plans-fall-back-to-dots', dense.at1 && !dense.zoomed, JSON.stringify(dense));

      // The row tools belong to placing mode: outside it the bar would offer two
      // controls with nothing to act on. This checks the wiring that sets
      // `hidden`; the stylesheet rule beside it is belt-and-braces for engines
      // whose [hidden] does not outrank `.btn`'s own display.
      const tools = await zp.evaluate(() => {
        const vis = (id) => {
          const b = document.getElementById(id);
          return !!b && getComputedStyle(b).display !== 'none';
        };
        const before = { row: vis('spotRowBtn'), clear: vis('spotClearBtn') };
        document.getElementById('spotEditBtn').click();
        const during = { row: vis('spotRowBtn'), clear: vis('spotClearBtn') };
        document.getElementById('spotEditBtn').click();
        return { before, during };
      });
      check('spots-row-tools-only-while-placing',
        !tools.before.row && !tools.before.clear && tools.during.row && tools.during.clear,
        JSON.stringify(tools));

      // A pin grows with the zoom, but nowhere near as fast as the plan: one
      // step multiplies the plan by 1.5 and the pin by about 1.05, so leaning
      // in keeps spreading pins apart instead of packing them tighter. Measured
      // between two zoom levels that are both past the dense cutoff, or the
      // fallback's own size change would answer for the scale.
      const pinWidth = () => zp.evaluate(() =>
        document.querySelector('.map-spot[data-spot-no="3"]').getBoundingClientRect().width);
      await mapSettled(zp);
      const pinA = await pinWidth();
      await zp.evaluate(() => document.getElementById('mapZoomIn').click());
      await mapSettled(zp);
      const pin = { a: pinA, b: await pinWidth(), zoom: await zp.textContent('#mapZoomVal') };
      check('map-zoom-grows-pins-slower-than-the-plan',
        pin.b > pin.a * 1.02 && pin.b < pin.a * 1.15 && pin.a > 10, JSON.stringify(pin));

      // Frosted glass costs a render surface per pin. On a plan with a couple
      // hundred of them the compositor re-layerized the whole map on every
      // frame of a pan — 155ms of Layerize per gesture against 78ms without,
      // measured on a throttled phone. Nothing about the look says so, which is
      // exactly why it needs a check rather than a comment.
      const costly = await zp.evaluate(() => {
        const s = getComputedStyle(document.querySelector('.map-spot'));
        return { backdrop: s.backdropFilter, filter: s.filter };
      });
      check('map-pins-carry-no-backdrop-filter',
        (costly.backdrop === 'none' || !costly.backdrop) && (costly.filter === 'none' || !costly.filter),
        JSON.stringify(costly));

      // Zoom is a size, not a transform. `transform: scale()` looked right in
      // Chromium, which re-rasterises the drawing at the scale it is shown at;
      // WebKit keeps the bitmap it first painted and stretches it, so on an
      // iPhone a vector plan came out mush at the zoom the gate reads it at.
      // What has to hold is that at rest nothing is being scaled: the wrapper
      // is laid out at its zoomed width and the transform only ever pans.
      await mapSettled(zp);
      const zoomed = await zp.evaluate(() => {
        const wrap = document.getElementById('mapImageWrap');
        const vp = document.getElementById('mapViewport');
        return {
          t: wrap.style.transform, w: wrap.style.width,
          ratio: wrap.getBoundingClientRect().width / vp.clientWidth,
          val: document.getElementById('mapZoomVal').textContent,
        };
      });
      check('map-zoom-lays-the-plan-out-larger',
        Math.abs(zoomed.ratio - 3.375) < 0.02 && zoomed.val === '338%', JSON.stringify(zoomed));
      check('map-zoom-never-stretches-what-it-drew',
        !/scale/.test(zoomed.t) && /^translate\(/.test(zoomed.t), JSON.stringify(zoomed));

      // Dragging past the corner must stop at the corner: a plan that can be
      // pulled off its own frame leaves the reader looking at nothing.
      //
      // Dragged repeatedly, because one swipe is shorter than the slack at this
      // zoom — the first version of this check moved the plan a third of the way
      // and passed with the clamp deliberately removed.
      const vpBox = await zp.evaluate(() => {
        const r = document.getElementById('mapViewport').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      // Kept away from the bottom-right corner: the zoom control lives there
      // and a gesture starting on it is not a pan at all.
      const swipe = async (fromF, toF) => {
        for (let i = 0; i < 4; i++) {
          await zp.mouse.move(vpBox.x + vpBox.w * fromF, vpBox.y + vpBox.h * fromF);
          await zp.mouse.down();
          await zp.mouse.move(vpBox.x + vpBox.w * toF, vpBox.y + vpBox.h * toF, { steps: 8 });
          await zp.mouse.up();
          await zp.waitForTimeout(80);
        }
      };
      // Against the frame's content box, not its border box: the clamp works in
      // clientWidth, and comparing to the outer rect is off by the 1px border.
      const corners = async () => zp.evaluate(() => {
        const vp2 = document.getElementById('mapViewport');
        const v = vp2.getBoundingClientRect(), cs = getComputedStyle(vp2);
        const x0 = v.left + (parseFloat(cs.borderLeftWidth) || 0);
        const y0 = v.top + (parseFloat(cs.borderTopWidth) || 0);
        const w = document.getElementById('mapImageWrap').getBoundingClientRect();
        return { l: w.left - x0, t: w.top - y0, r: w.right - (x0 + vp2.clientWidth), b: w.bottom - (y0 + vp2.clientHeight) };
      });
      await swipe(0.10, 0.85);          // pull the plan down-right, past its own edge
      const atStart = await corners();

      await swipe(0.85, 0.10);          // and back up-left, past the other edge
      const atEnd = await corners();
      check('map-pan-cannot-expose-a-void',
        Math.abs(atStart.l) < 1 && Math.abs(atStart.t) < 1
        && Math.abs(atEnd.r) < 1 && Math.abs(atEnd.b) < 1,
        JSON.stringify({ atStart, atEnd }));

      // A touch screen does not promise a `pointerup` for every `pointerdown`:
      // a call arrives, the system claims the gesture, the finger leaves over
      // the edge. A finger left behind in the set makes every later drag look
      // like half a pinch — and then the map zooms but never moves, with
      // nothing to do about it short of reloading the page.
      await swipe(0.10, 0.85);                    // back against the top-left stop
      const ghost = await zp.evaluate(() => {
        const vp2 = document.getElementById('mapViewport');
        const wrap = document.getElementById('mapImageWrap');
        const r = vp2.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
        const fire = (type, x, y, id) => {
          const t = document.elementFromPoint(x, y) || vp2;
          t.dispatchEvent(new PointerEvent(type, { pointerId: id, isPrimary: true,
            clientX: x, clientY: y, bubbles: true, cancelable: true }));
        };
        const dx = () => {
          const m = /translate\((-?[\d.]+)px/.exec(wrap.style.transform);
          return m ? +m[1] : 0;
        };
        fire('pointerdown', cx, cy, 91);           // a finger that never lifts
        fire('pointermove', cx - 20, cy - 20, 91);
        const before = dx(), zoom = document.getElementById('mapZoomVal').textContent;
        fire('pointerdown', cx, cy, 92);           // the drag that comes after it
        fire('pointermove', cx - 40, cy - 30, 92);
        fire('pointermove', cx - 90, cy - 60, 92);
        const after = dx();
        fire('pointerup', cx - 90, cy - 60, 92);
        return { before, after, zoom, zoomAfter: document.getElementById('mapZoomVal').textContent };
      });
      check('map-pan-survives-a-finger-that-never-lifts',
        ghost.after - ghost.before < -20 && ghost.zoomAfter === ghost.zoom,
        JSON.stringify(ghost));

      // Placing while zoomed in is the normal case on a dense plan, so the
      // percentage written down has to be the point under the finger — not the
      // point it would have been at fit-width.
      await zp.selectOption('#spotZone', 'Euro');
      await zp.evaluate(() => document.getElementById('spotEditBtn').click());
      const geo = await zp.evaluate(() => {
        const w = document.getElementById('mapImageWrap').getBoundingClientRect();
        const v = document.getElementById('mapViewport').getBoundingClientRect();
        return { wx: w.x, wy: w.y, ww: w.width, wh: w.height, vx: v.x, vy: v.y, vw: v.width, vh: v.height };
      });
      const tapX = geo.vx + geo.vw * 0.28, tapY = geo.vy + geo.vh * 0.34;
      const want = { x: (tapX - geo.wx) / geo.ww * 100, y: (tapY - geo.wy) / geo.wh * 100 };
      await zp.mouse.click(tapX, tapY);
      await zp.waitForTimeout(500);
      const one = (saved || []).find((sp) => sp.zone === 'Euro');
      check('spots-placed-where-tapped-when-zoomed',
        !!one && Math.abs(one.x - want.x) < 1 && Math.abs(one.y - want.y) < 1,
        JSON.stringify({ one, want }));

      await zp.evaluate(() => document.getElementById('mapZoomReset').click());
      await mapSettled(zp);
      const back = await zp.evaluate(() => {
        const wrap = document.getElementById('mapImageWrap');
        const vp = document.getElementById('mapViewport');
        const w = wrap.getBoundingClientRect(), v = vp.getBoundingClientRect();
        const cs = getComputedStyle(vp);
        const x0 = v.left + (parseFloat(cs.borderLeftWidth) || 0);
        const y0 = v.top + (parseFloat(cs.borderTopWidth) || 0);
        return {
          t: wrap.style.transform, val: document.getElementById('mapZoomVal').textContent,
          // Slack left over on each side, which is what "fits and is centred"
          // means: the same at both ends, and never negative.
          slackX: [w.left - x0, (x0 + vp.clientWidth) - w.right],
          slackY: [w.top - y0, (y0 + vp.clientHeight) - w.bottom],
        };
      });
      check('map-zoom-reset-returns-to-fit',
        back.val === '100%' && !/scale/.test(back.t)
        && back.slackX.every((v2) => v2 > -1) && back.slackY.every((v2) => v2 > -1)
        && Math.abs(back.slackX[0] - back.slackX[1]) < 2
        && Math.abs(back.slackY[0] - back.slackY[1]) < 2,
        JSON.stringify(back));

      // A whole row from its two ends. This is the difference between laying a
      // plan and typing one in: forty slots for two taps and a number.
      saved = null;
      await zp.selectOption('#spotZone', 'Stance');
      await zp.evaluate(() => document.getElementById('spotRowBtn').click());
      const wrapBox = await zp.evaluate(() => {
        const r = document.getElementById('mapImageWrap').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      await zp.mouse.click(wrapBox.x + wrapBox.w * 0.20, wrapBox.y + wrapBox.h * 0.80);
      await zp.waitForTimeout(250);
      await zp.mouse.click(wrapBox.x + wrapBox.w * 0.80, wrapBox.y + wrapBox.h * 0.90);
      await zp.waitForTimeout(400);
      await zp.fill('#uiDialogInput', '5');
      await zp.evaluate(() => document.getElementById('uiDialogOk').click());
      await zp.waitForTimeout(600);
      const row = (saved || []).filter((sp) => sp.zone === 'Stance' && sp.no > 26).sort((a, b) => a.no - b.no);
      check('spots-row-places-the-whole-rank', row.length === 5, JSON.stringify(row.map((r2) => r2.no)));
      check('spots-row-ends-land-on-the-taps',
        row.length === 5
        && Math.abs(row[0].x - 20) < 1.5 && Math.abs(row[0].y - 80) < 1.5
        && Math.abs(row[4].x - 80) < 1.5 && Math.abs(row[4].y - 90) < 1.5,
        JSON.stringify(row.length ? [row[0], row[4]] : []));
      // Evenly spaced, not merely present: the middle spot sits halfway.
      check('spots-row-spaced-evenly',
        row.length === 5 && Math.abs(row[2].x - 50) < 1.5 && Math.abs(row[2].y - 85) < 1.5,
        JSON.stringify(row[2] || null));
      // The zone already had 26 spots, so the row continues at 27 — a second
      // rank must not renumber the first.
      check('spots-row-numbers-continue-the-zone',
        row.length === 5 && row[0].no === 27 && row[4].no === 31, JSON.stringify(row.map((r2) => r2.no)));

      // Moving a car to another zone: the spot number belongs to the zone it
      // was given in, so it cannot travel. Kept, it would either point at a
      // spot the new zone does not have or collide with the car already there,
      // and the unique index would refuse the move with a duplicate-key error.
      carPatches.length = 0;
      await zp.evaluate(() =>
        document.querySelector('.tab[data-section="cars"], .mtab[data-section="cars"]')?.click());
      await zp.waitForTimeout(400);
      await zp.evaluate(() => document.querySelector('[data-row-id="1"] .row-title')?.click());
      await zp.waitForSelector('#carZoneInput', { timeout: 6000 });
      await zp.waitForTimeout(300);
      await zp.selectOption('#carZoneInput', 'Euro');
      await zp.waitForTimeout(600);
      const moved = carPatches.map((c2) => c2.body.replace(/\s/g, ''));
      check('car-zone-change-releases-the-spot',
        moved.some((b) => /"zone":"Euro"/.test(b) && /"spot_no":null/.test(b)), JSON.stringify(moved));

      // `cars.zone` is NOT NULL with an empty-string default, so clearing the
      // zone has to write '' — null is refused outright and the picker's own
      // placeholder option becomes an error message.
      carPatches.length = 0;
      await zp.waitForSelector('#carZoneInput', { timeout: 6000 });
      await zp.selectOption('#carZoneInput', '');
      await zp.waitForTimeout(600);
      const cleared = carPatches.map((c2) => c2.body.replace(/\s/g, ''));
      check('car-zone-change-never-writes-null-zone',
        cleared.length > 0 && cleared.every((b) => !/"zone":null/.test(b)) && cleared.some((b) => /"zone":""/.test(b)),
        JSON.stringify(cleared));

      // Clearing a zone has to free the cars standing in it, or their cards
      // keep pointing at a spot that no longer exists. Runs after the move
      // above, so the zone change is not waiting on a hydration fetch that a
      // loaded machine may not deliver in time. Which ids the freeing write
      // names is left open on purpose: the fixture answers every read with the
      // same two cars, so a re-read can put one of them back on its spot.
      carPatches.length = 0;
      saved = null;
      await zp.evaluate(() => {
        document.getElementById('modal-car-detail')?.classList.remove('show');
        document.querySelector('.tab[data-section="map"], .mtab[data-section="map"]')?.click();
      });
      await zp.waitForTimeout(300);
      await zp.evaluate(() => document.getElementById('spotClearBtn').click());
      await zp.waitForTimeout(400);
      await zp.evaluate(() => document.getElementById('uiDialogOk').click());
      await zp.waitForTimeout(700);
      const freed = carPatches.find((c2) => /"spot_no":null/.test(c2.body.replace(/\s/g, '')));
      const leftOver = (saved || []).filter((sp) => sp.zone === 'Stance');
      check('spots-clearing-a-zone-frees-its-cars',
        !!freed && /id=in\./.test(freed.url) && Array.isArray(saved) && leftOver.length === 0,
        JSON.stringify({ freed: freed && freed.url, leftOver: leftOver.length, saved: (saved || []).length }));

    } catch (e) {
      for (const n of ['spots-row-places-the-whole-rank', 'spots-row-ends-land-on-the-taps',
        'spots-row-spaced-evenly', 'spots-row-numbers-continue-the-zone',
        'map-zoom-lays-the-plan-out-larger', 'map-zoom-never-stretches-what-it-drew',
        'map-zoom-grows-pins-slower-than-the-plan', 'map-pins-carry-no-backdrop-filter',
        'map-zoom-reset-returns-to-fit', 'map-pan-cannot-expose-a-void',
        'map-pan-survives-a-finger-that-never-lifts',
        'spots-placed-where-tapped-when-zoomed', 'spots-dense-plans-fall-back-to-dots',
        'spots-clearing-a-zone-frees-its-cars', 'car-zone-change-releases-the-spot',
        'car-zone-change-never-writes-null-zone', 'spots-row-tools-only-while-placing']) {
        if (!checks.some((c2) => c2.name === n)) check(n, false);
      }
      console.log(`map zoom/row checks: ${e.message}`);
    }
    await zctx.close();
  }

  // 4r. The plan editor (`plan.html`). It shares nothing with the zone map above:
  // no Supabase, no ui_settings, no photo in the saved plan. The photo is a
  // tracing template and the drawing is the deliverable, so what is checked here
  // is that shapes can be drawn, a row re-spaces itself, and the plan outlives
  // the photo it was traced from.
  {
    const pctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pp = await pctx.newPage();
    const perrs = [];
    pp.on('pageerror', (e) => perrs.push(e.message));
    try {
      await pp.goto(`${BASE}/plan.html`, { waitUntil: 'domcontentloaded' });
      await pp.evaluate(() => localStorage.clear());
      await pp.reload({ waitUntil: 'domcontentloaded' });
      await pp.waitForTimeout(400);
      const box = await pp.locator('#stage').boundingBox();
      const at = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

      // A zone: a click per corner, Enter closes it.
      await pp.click('.tool[data-tool="zone"]');
      for (const [fx, fy] of [[0.25, 0.2], [0.6, 0.2], [0.6, 0.5], [0.25, 0.5]]) {
        const q = at(fx, fy);
        await pp.mouse.click(q.x, q.y);
        await pp.waitForTimeout(50);
      }
      await pp.keyboard.press('Enter');
      await pp.waitForTimeout(200);
      check('plan-zone-drawn', await pp.textContent('#sItems') === '1');
      check('plan-zone-area-in-square-metres', (+(await pp.textContent('#sArea'))) > 0);

      // A row: one drag gives both ends, and the count comes from the length.
      await pp.click('.tool[data-tool="row"]');
      const a = at(0.3, 0.7), b = at(0.75, 0.7);
      await pp.mouse.move(a.x, a.y);
      await pp.mouse.down();
      await pp.mouse.move(b.x, b.y, { steps: 10 });
      await pp.mouse.up();
      await pp.waitForTimeout(700);
      // "More than one spot" passes with the spacing broken. What the row
      // promises is that its spots come from its length, so check that number.
      const row = await pp.evaluate(() => {
        const it = JSON.parse(localStorage.getItem('kultura.plan.v1') || '{}').items
          .find((x) => x.t === 'row');
        return it ? { len: Math.hypot(it.b[0] - it.a[0], it.b[1] - it.a[1]), n: it.n } : null;
      });
      check('plan-row-spots-follow-its-length',
        !!row && row.n > 1 && (+(await pp.textContent('#sSpots'))) === Math.round(row.len / 2.5));

      // Retuning the count must not steal the field being typed into.
      await pp.fill('#pN', '12');
      await pp.waitForTimeout(250);
      check('plan-row-recount', await pp.textContent('#sSpots') === '12');
      check('plan-panel-keeps-focus',
        await pp.evaluate(() => document.activeElement && document.activeElement.id) === 'pN');

      // A facing row continues the numbering rather than repeating it.
      await pp.click('[data-act="rowdup"]');
      await pp.waitForTimeout(250);
      check('plan-parallel-row-continues-numbering',
        await pp.textContent('#sSpots') === '24' && await pp.locator('#dupWarn').isHidden());

      await pp.keyboard.press('Control+z');
      await pp.waitForTimeout(200);
      check('plan-undo', await pp.textContent('#sSpots') === '12');

      // The plan is the drawing: it survives a reload, and it survives losing
      // the photo it was traced from — which never entered the saved plan.
      await pp.waitForTimeout(700);
      await pp.reload({ waitUntil: 'domcontentloaded' });
      await pp.waitForTimeout(500);
      check('plan-persists-locally', await pp.textContent('#sItems') === '2');
      check('plan-holds-no-photo',
        !(await pp.evaluate(() => localStorage.getItem('kultura.plan.v1') || '')).includes('data:image'));
      check('plan-never-touches-supabase',
        !(await pp.evaluate(() => document.documentElement.innerHTML)).includes('supabase'));

      // A plan kept beside the page opens from a link, so a venue plan can be
      // handed round as a URL instead of a file.
      await pp.evaluate(() => localStorage.clear());
      await pp.goto(`${BASE}/plan.html?load=plans/plan-06.json`, { waitUntil: 'domcontentloaded' });
      await pp.waitForTimeout(2500);
      check('plan-load-param-opens-a-bundled-plan', (+(await pp.textContent('#sSpots'))) > 200,
        await pp.textContent('#sSpots'));

      // A plan traced from a drawing carries thousands of background shapes.
      // They live on their own layer: locked, so clicks reach the plan through
      // them, and redrawn only when they change — not on every frame of a drag.
      const layers = await pp.evaluate(() => ({
        scenery: document.getElementById('scenery').childElementCount,
        live: document.getElementById('items').childElementCount,
        pe: document.getElementById('scenery').getAttribute('pointer-events'),
        bg: getComputedStyle(document.getElementById('stageWrap')).backgroundColor,
      }));
      check('plan-scenery-on-its-own-layer',
        layers.scenery > 1000 && layers.live > 200 && layers.live < layers.scenery,
        JSON.stringify(layers));
      check('plan-scenery-locked-so-clicks-pass-through', layers.pe === 'none', layers.pe);
      check('plan-paper-background', layers.bg !== 'rgba(0, 0, 0, 0)' && !/^rgb\(7, 8, 13\)/.test(layers.bg), layers.bg);
      await pp.click('#sceneryBtn');
      await pp.waitForTimeout(250);
      check('plan-scenery-unlocks-on-demand',
        await pp.evaluate(() => document.getElementById('scenery').getAttribute('pointer-events')) === 'auto');

      // …but only from beside the page. A link is the one input a stranger
      // controls, so the path must never climb out of the site.
      const asked = [];
      pp.on('request', (r) => asked.push(r.url()));
      await pp.evaluate(() => localStorage.clear());
      await pp.goto(`${BASE}/plan.html?load=../../etc/passwd`, { waitUntil: 'domcontentloaded' });
      await pp.waitForTimeout(700);
      check('plan-load-param-refuses-a-path-outside-the-site',
        // The page's own URL carries the word too — it is the path that matters.
        await pp.textContent('#sItems') === '0'
        && !asked.some((u) => /passwd/.test(new URL(u).pathname)));

      // The venue's own drawing usually arrives as a PDF, not a photo.
      const pdf = tinyPdf();
      await pp.goto(`${BASE}/plan.html`, { waitUntil: 'domcontentloaded' });
      await pp.evaluate(() => localStorage.clear());
      await pp.reload({ waitUntil: 'domcontentloaded' });
      await pp.waitForTimeout(400);
      await pp.setInputFiles('#uFile', { name: 'plan.pdf', mimeType: 'application/pdf', buffer: pdf });
      await pp.waitForTimeout(3000);
      const href = await pp.getAttribute('#uImg', 'href');
      const aspect = await pp.evaluate(() => {
        const im = document.getElementById('uImg');
        return +im.getAttribute('width') / +im.getAttribute('height');
      });
      check('plan-pdf-becomes-the-template',
        await pp.locator('#uImg').isVisible() && !!href && href.startsWith('data:image/')
        && Math.abs(aspect - 2) < 0.02, 'aspect=' + aspect);
      check('plan-pdf-stays-out-of-the-saved-plan',
        !(await pp.evaluate(() => localStorage.getItem('kultura.plan.v1') || '')).includes('data:image'));
    } catch (e) {
      for (const n of ['plan-zone-drawn', 'plan-zone-area-in-square-metres',
        'plan-row-spots-follow-its-length', 'plan-row-recount', 'plan-panel-keeps-focus',
        'plan-parallel-row-continues-numbering', 'plan-undo', 'plan-persists-locally',
        'plan-holds-no-photo', 'plan-never-touches-supabase',
        'plan-load-param-opens-a-bundled-plan', 'plan-load-param-refuses-a-path-outside-the-site',
        'plan-pdf-becomes-the-template', 'plan-pdf-stays-out-of-the-saved-plan',
        'plan-scenery-on-its-own-layer', 'plan-scenery-locked-so-clicks-pass-through',
        'plan-paper-background', 'plan-scenery-unlocks-on-demand']) {
        if (!checks.some((c2) => c2.name === n)) check(n, false);
      }
      console.log(`plan editor checks: ${e.message}`);
    }
    check('plan-no-errors', perrs.length === 0);
    if (perrs.length) console.log('  plan.html errors:', perrs.slice(0, 3));
    await pctx.close();
  }

  // What `storage.buckets` really says about `maps`, so the stand-in refuses
  // what production refuses: SVG among them, and anything over 5 MB.
  const MAPS_BUCKET = { max: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] };

  // 4s. The drawn plan becoming the app's map.
  //
  // Two ways of saying where a car goes meet here: the plan is a drawing in
  // metres, the map is an image with pins in percentages of it. What must hold
  // is that the pins land on the bays — so the render and the conversion have
  // to come from the same view box — and that nothing is lost quietly: a car
  // whose spot is not on the new plan has to be freed, and spots the drawing
  // gives no zone have to be reported rather than dropped in silence.
  {
    const CARS = [
      { id: 1, entry_no: 11, brand: 'VW', model: 'Golf', owner: 'Ana', plate: 'P1', status: 'Sosit', zone: 'Stance', spot_no: 1, event_id: 6, deleted_at: null },
      { id: 2, entry_no: 12, brand: 'Mazda', model: 'RX7', owner: 'Ion', plate: 'P2', status: 'Invitat', zone: 'Stance', spot_no: 999, event_id: 6, deleted_at: null },
    ];
    let savedSpots = null, savedUrl = null, savedPlan = null, uploaded = null;
    const carPatches = [];
    const mctx2 = await browser.newContext({ viewport: { width: 1280, height: 950 } });
    await mctx2.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url(), m = r.request().method();
      const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (u.includes('/storage/v1/object/public/maps/')) {
        // What the map renders does not depend on the bytes, and a raster
        // cannot survive Playwright's string body, so the stand-in serves a
        // picture of the right shape rather than the one just uploaded.
        return r.fulfill({ status: 200, contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="3600" height="4210"'
            + ' viewBox="0 0 3600 4210"><rect width="3600" height="4210" fill="#f4f3ee"/></svg>' });
      }
      if (u.includes('/storage/v1/object/maps/')) {
        if (m === 'POST' || m === 'PUT') {
          const body = r.request().postData() || '';
          const bytes = (r.request().postDataBuffer() || Buffer.from(body)).length;
          const type = (body.match(/Content-Type:\s*([\w/+.-]+)/i) || [])[1] || '';
          // The real bucket's rules, because a mock that accepts everything is
          // how "mime type image/svg+xml is not supported" reached production.
          if (!MAPS_BUCKET.types.includes(type)) {
            return r.fulfill({ status: 415, contentType: 'application/json',
              body: JSON.stringify({ statusCode: '415', error: 'InvalidMimeType',
                message: `mime type ${type} is not supported` }) });
          }
          if (bytes > MAPS_BUCKET.max) {
            return r.fulfill({ status: 413, contentType: 'application/json',
              body: JSON.stringify({ statusCode: '413', error: 'Payload too large',
                message: 'The object exceeded the maximum allowed size' }) });
          }
          uploaded = { url: u, type, bytes };
          return J({ Key: 'maps/x' });
        }
        return J({});
      }
      if (u.includes('/rest/v1/ui_settings')) {
        if (m === 'POST') {
          try {
            const b = JSON.parse(r.request().postData() || '{}');
            if (b.key === 'zone_spots') savedSpots = JSON.parse(b.value);
            if (b.key === 'zone_map_url') savedUrl = b.value;
            if (b.key === 'zone_plan_url') savedPlan = b.value;
          } catch (_) { /* the assertions below report it */ }
        }
        return J([]);
      }
      if (u.includes('/rest/v1/cars')) {
        if (m === 'PATCH') { carPatches.push({ url: u, body: r.request().postData() || '' }); return J([]); }
        return J(/deleted_at=not\.is\.null/.test(u) ? [] : CARS);
      }
      if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'Ev', status: 'Activ', starts_at: new Date(Date.now() + 864e5).toISOString() }]);
      if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
      if (u.includes('/rest/v1/')) return J([]);
      if (u.includes('/functions/v1/')) return J({});
      return r.abort();
    });
    const ip = await mctx2.newPage();
    const ierrs = [];
    ip.on('pageerror', (e) => ierrs.push(e.message));
    try {
      await ip.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await ip.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      })));
      await ip.reload({ waitUntil: 'domcontentloaded' });
      await ip.waitForTimeout(2600);
      await ip.evaluate(() => {
        document.getElementById('splashScreen')?.remove();
        document.querySelector('.tab[data-section="map"], .mtab[data-section="map"]')?.click();
      });
      await ip.waitForTimeout(500);
      check('plan-import-button-for-staff', await ip.locator('#mapPlanBtn').isVisible());

      await ip.click('#mapPlanBtn');
      await ip.waitForTimeout(700);
      await ip.evaluate(() => document.getElementById('uiDialogOk')?.click());
      // Rendering 4800px of plan and encoding it takes seconds on this machine
      // and longer on a slow runner, so wait for the result rather than a clock.
      for (let i = 0; i < 80 && !savedSpots; i++) await ip.waitForTimeout(250);
      await ip.waitForTimeout(500);

      // No picture is made of the plan. A raster has a resolution and this map
      // is read at 8x, which is where it turns to mush; what gets saved is
      // where the drawing lives, and the page draws it as SVG. The bucket is
      // still watched here, because "it uploads nothing" is the claim.
      check('plan-import-keeps-the-plan-a-drawing',
        savedPlan === 'plans/plan-06.json' && !uploaded,
        `plan=${savedPlan} uploaded=${uploaded ? uploaded.type : 'none'}`);
      // 258 spots are drawn; 20 of them sit outside every zone the drawing
      // names, and a spot without a zone can never take a car.
      check('plan-import-saves-the-spots',
        Array.isArray(savedSpots) && savedSpots.length === 238,
        savedSpots ? String(savedSpots.length) : 'none');
      check('plan-import-pins-land-inside-the-image',
        Array.isArray(savedSpots) && savedSpots.every((sp) => sp.x >= 0 && sp.x <= 100 && sp.y >= 0 && sp.y <= 100));
      // A pin that knows only where its bay is can be a dot and nothing else.
      // The size and the heading are what let it be drawn as a car standing in
      // the bay, so they have to survive the conversion into percentages.
      check('plan-import-pins-carry-their-bay',
        Array.isArray(savedSpots) && savedSpots.every((sp) =>
          sp.w > 0 && sp.w < 5 && sp.h > 0 && sp.h < 5 && Number.isFinite(sp.r) && sp.r >= 0 && sp.r < 360)
        && new Set(savedSpots.map((sp) => Math.round(sp.r))).size > 3,
        JSON.stringify(savedSpots && savedSpots[0]));
      // The drawing says MODERN CARS, the app says Modern. Unless they are
      // reconciled, a car parked in Modern matches no pin at all.
      const zones = [...new Set((savedSpots || []).map((sp) => sp.zone))];
      check('plan-import-speaks-the-app-zone-names',
        zones.includes('Modern') && zones.includes('Stance') && !zones.includes('MODERN CARS'),
        zones.slice(0, 6).join(', '));
      const freed = carPatches.find((c) => /"spot_no":null/.test(c.body.replace(/\s/g, '')));
      check('plan-import-frees-a-car-whose-spot-is-gone',
        !!freed && /id=in\./.test(freed.url) && /2/.test(freed.url.split('id=in.')[1] || ''),
        freed ? freed.url.split('id=in.')[1] : 'no patch');
      const note = await ip.textContent('#mapStatus');
      check('plan-import-says-what-it-left-out', /20/.test(note || ''), (note || '').slice(0, 60));
      await ip.waitForTimeout(1200);
      const drawn = await ip.evaluate(() => {
        const pin = document.querySelector('#mapSpotLayer .map-spot');
        return {
          pins: document.querySelectorAll('#mapSpotLayer .map-spot').length,
          cars: document.querySelectorAll('#mapCars .cp').length,
          deck: document.getElementById('mapCars')?.getAttribute('viewBox') || '',
          hit: getComputedStyle(document.getElementById('mapCars')).pointerEvents,
          shapes: document.querySelectorAll('#mapPlan svg *').length,
          img: !!document.getElementById('mapImage'),
          r: pin && pin.style.getPropertyValue('--r'),
          w: pin && pin.style.width,
        };
      });
      check('plan-import-map-shows-the-drawing-and-its-pins',
        drawn.pins === 238 && drawn.shapes > 1000 && !drawn.img, JSON.stringify(drawn));
      // Every pin is a car standing in its own bay, turned the way the bay is.
      // The cars are drawn together on one deck under the pins, not one small
      // document inside each: two hundred of those doubled the compositor's
      // work per pan and were hit-tested on the way to the button over them.
      check('plan-import-pins-are-cars-in-their-bays',
        drawn.cars === 238 && /deg$/.test(drawn.r || '') && /%$/.test(drawn.w || '')
        && /^[-\d.]+ [-\d.]+ [\d.]+ [\d.]+$/.test(drawn.deck) && drawn.hit === 'none',
        JSON.stringify(drawn));
      // The car is the bay, so it grows with the drawing rather than against
      // it: at twice the zoom it is twice as wide. A pin held at a fixed size
      // on screen would sit in a bay four times its width by the far end of the
      // range, which is a dot on a plan again.
      const fitPx = await ip.evaluate(() =>
        Math.round(document.querySelector('#mapPlan svg').getBoundingClientRect().width));
      const grew = await ip.evaluate(() => {
        const w = () => document.querySelector('#mapSpotLayer .map-spot.is-car')
          .getBoundingClientRect().width;
        const a = w();
        document.getElementById('mapZoomIn').click();
        document.getElementById('mapZoomIn').click();   // 1.5 x 1.5 = 2.25
        return { a, b: w() };
      });
      check('plan-import-cars-grow-with-the-plan',
        grew.b > grew.a * 2.1 && grew.b < grew.a * 2.4, JSON.stringify(grew));
      // And the drawing under them is laid out at that size rather than
      // stretched to it. An SVG painted at fit-width and then scaled is a
      // bitmap with extra steps — which is what a vector plan turned into on an
      // iPhone, where the engine keeps the raster it first made.
      await mapSettled(ip);
      const sharp = await ip.evaluate(() => {
        const wrap = document.getElementById('mapImageWrap');
        const svg = document.querySelector('#mapPlan svg');
        return {
          zoom: document.getElementById('mapZoomVal').textContent,
          svgPx: Math.round(svg.getBoundingClientRect().width),
          t: wrap.style.transform,
        };
      });
      // Against its own size at fit, not against the frame: the frame is wider
      // than the drawing now, and comparing to it would measure the wrong box.
      check('plan-import-draws-the-plan-at-the-zoomed-size',
        sharp.svgPx > fitPx * 2.1 && sharp.svgPx < fitPx * 2.4 && !/scale/.test(sharp.t),
        JSON.stringify({ ...sharp, fitPx }));

      await ip.evaluate(() => document.getElementById('mapZoomReset').click());
      await mapSettled(ip);
      // The whole plan on one screen. A venue plan is about as tall as it is
      // wide, so left to itself the frame filled the window and then some —
      // map or controls, never both.
      const framed = await ip.evaluate(() => {
        const vp = document.getElementById('mapViewport');
        const w = document.getElementById('mapImageWrap').getBoundingClientRect();
        const v = vp.getBoundingClientRect();
        return { frameH: Math.round(v.height), frameW: Math.round(v.width), screenH: innerHeight,
          // Where the frame ends against the fold — the claim is that the map
          // and everything above it are on one screen, not that the frame is
          // under some share of the window.
          bottom: Math.round(v.bottom),
          columnW: Math.round(document.getElementById('mapContainer').getBoundingClientRect().width),
          slackX: [Math.round(w.left - v.left), Math.round(v.right - w.right)],
          inside: w.width <= v.width + 2 && w.height <= v.height + 2 };
      });
      check('plan-import-fits-the-whole-plan-on-one-screen',
        framed.bottom <= framed.screenH && framed.inside, JSON.stringify(framed));
      // The frame takes the width it is given; the drawing sits centred inside
      // it, whole. Trimmed to the drawing's own shape the frame looked tidy and
      // gave nothing back — at full width the extra is room to move around in
      // once you lean in.
      check('plan-import-frame-fills-the-column-and-centres-the-plan',
        framed.frameW >= framed.columnW - 2 && framed.inside
        && Math.abs(framed.slackX[0] - framed.slackX[1]) < 2,
        JSON.stringify(framed));

      // A car standing in a zone is painted that zone's own colour — the same
      // colour the zone is drawn in underneath it. STANCE is #e89b00 on this
      // plan, and car #11 is on Stance#1.
      const ink = await ip.evaluate(() => {
        const g = document.querySelector('#mapCars .cp.taken');
        const free = document.querySelector('#mapCars .cp.free .cp-body');
        return {
          zone: (g && g.style.getPropertyValue('--zone').trim()) || '',
          takenFill: (g && getComputedStyle(g.querySelector('.cp-body')).fill) || '',
          freeFill: (free && getComputedStyle(free).fill) || '',
          // An arrived car is a taken one too — written as one or the other,
          // it came out painted like an empty bay.
          arrived: document.querySelectorAll('#mapCars .cp.taken.here').length,
        };
      });
      ink.saved = ((savedSpots || []).find((sp) => sp.zone === 'Stance') || {}).c || '';
      check('plan-import-paints-a-car-in-its-zone-colour',
        ink.saved.toLowerCase() === '#e89b00' && ink.zone.toLowerCase() === '#e89b00'
        && /232, 155, 0/.test(ink.takenFill) && ink.arrived === 1, JSON.stringify(ink));
      // An empty bay is the drawing of a car and nothing else: white body, dark
      // lines. Painted, it would say somebody is standing there.
      check('plan-import-leaves-an-empty-bay-uncoloured',
        /255, 255, 255/.test(ink.freeFill || ''), JSON.stringify(ink));
    } catch (e) {
      for (const n of ['plan-import-button-for-staff', 'plan-import-keeps-the-plan-a-drawing',
        'plan-import-saves-the-spots', 'plan-import-pins-land-inside-the-image',
        'plan-import-pins-carry-their-bay',
        'plan-import-speaks-the-app-zone-names', 'plan-import-frees-a-car-whose-spot-is-gone',
        'plan-import-says-what-it-left-out', 'plan-import-map-shows-the-drawing-and-its-pins',
        'plan-import-pins-are-cars-in-their-bays', 'plan-import-cars-grow-with-the-plan',
        'plan-import-draws-the-plan-at-the-zoomed-size',
        'plan-import-fits-the-whole-plan-on-one-screen',
        'plan-import-frame-fills-the-column-and-centres-the-plan',
        'plan-import-paints-a-car-in-its-zone-colour', 'plan-import-leaves-an-empty-bay-uncoloured']) {
        if (!checks.some((c2) => c2.name === n)) check(n, false);
      }
      console.log(`plan import checks: ${e.message}`);
    }
    // The map a person uploads goes through the same ceiling. A photograph is
    // 17 MB as lossless PNG at full size, which is what this path produced
    // before — and the bucket refuses it outright. Quality may drop; the upload
    // may not simply fail.
    try {
      uploaded = null;
      await ip.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await ip.waitForTimeout(2600);
      await ip.evaluate(() => {
        document.getElementById('splashScreen')?.remove();
        document.querySelector('.tab[data-section="map"], .mtab[data-section="map"]')?.click();
      });
      await ip.waitForTimeout(400);
      // 4.3 megapixels of noise: about 5.8 MB as lossless PNG, which is what the
      // old path produced and the bucket refused.
      await ip.setInputFiles('#mapFileInput', { name: 'teren.png', mimeType: 'image/png', buffer: noisyPng(2400, 1800) });
      await ip.waitForSelector('#cropConfirm', { state: 'visible', timeout: 8000 });
      await ip.waitForTimeout(600);
      await ip.click('#cropConfirm');
      for (let i = 0; i < 80 && !uploaded; i++) await ip.waitForTimeout(250);
      check('map-upload-fits-the-bucket',
        !!uploaded && MAPS_BUCKET.types.includes(uploaded.type) && uploaded.bytes <= MAPS_BUCKET.max,
        uploaded ? `${uploaded.type} ${(uploaded.bytes / 1048576).toFixed(2)}MB` : 'rejected by the bucket');
    } catch (e) {
      if (!checks.some((c2) => c2.name === 'map-upload-fits-the-bucket')) check('map-upload-fits-the-bucket', false);
      console.log(`map upload check: ${e.message}`);
    }

    check('plan-import-no-errors', ierrs.length === 0);
    if (ierrs.length) console.log('  import errors:', ierrs.slice(0, 3));
    await mctx2.close();
  }

  // 4t. Choosing which car goes on a spot.
  //
  // A native select is a spinner scrolled blind: on a phone it hides the list
  // behind a wheel, and by fifty cars the name you want is somewhere in it. The
  // dialog is a list you can search and tap instead — and a tap is the answer,
  // because a confirm button after picking a name asks the same question twice.
  {
    const NAMES = ['Ana Pop', 'Ion Rusu', 'Maria Ciobanu', 'Vlad Ene', 'Dan Marin', 'Elena Popa'];
    const MAKES = [['VW', 'Golf'], ['Mazda', 'RX-7'], ['BMW', 'E36'], ['Audi', 'S4']];
    const CARS = [
      // Already on a spot: it must not be offered for another one.
      { id: 1, entry_no: 11, brand: 'Porsche', model: '911', owner: 'Radu Toma', plate: 'PLACED1',
        status: 'Sosit', zone: 'Stance', spot_no: 1, event_id: 6, deleted_at: null },
    ];
    for (let i = 0; i < 50; i++) {
      const m = MAKES[i % MAKES.length];
      CARS.push({ id: 100 + i, entry_no: 200 + i, brand: m[0], model: m[1],
        owner: NAMES[i % NAMES.length], plate: 'B' + (100 + i) + 'XYZ', status: 'Invitat',
        zone: 'Stance', spot_no: null, event_id: 6, deleted_at: null });
    }
    const SPOTS = [
      { zone: 'Stance', no: 1, x: 25, y: 40 },
      { zone: 'Stance', no: 2, x: 60, y: 40 },
    ];
    const carPatches = [];
    const actx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    await actx.route('**://*.supabase.co/**', (r) => {
      const u = r.request().url(), m = r.request().method();
      const J = (x) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (u.includes('/rest/v1/ui_settings')) {
        if (m === 'POST') return J([]);
        if (u.includes('zone_spots')) return J([{ value: JSON.stringify(SPOTS) }]);
        if (u.includes('zone_map_url')) return J([{ key: 'zone_map_url', value: 'https://map.test/plan.png' }]);
        return J([]);
      }
      if (u.includes('/rest/v1/cars')) {
        if (m === 'PATCH') { carPatches.push({ url: u, body: r.request().postData() || '' }); return J([]); }
        return J(/deleted_at=not\.is\.null/.test(u) ? [] : CARS);
      }
      if (u.includes('/rest/v1/events')) return J([{ id: 6, title: 'Ev', status: 'Activ', starts_at: new Date(Date.now() + 864e5).toISOString() }]);
      if (u.includes('/rest/v1/profiles')) return J([{ email: 'qa@example.com', full_name: 'QA', role: 'admin', is_admin: true }]);
      if (u.includes('/rest/v1/')) return J([]);
      if (u.includes('/functions/v1/')) return J({});
      return r.abort();
    });
    await actx.route('**://map.test/**', (r) => r.fulfill({
      status: 200, contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#2b3245"/></svg>',
    }));
    const ap = await actx.newPage();
    const aerrs = [];
    ap.on('pageerror', (e) => aerrs.push(e.message));
    try {
      await ap.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
      await ap.evaluate(() => localStorage.setItem('sb-knphmxxokowwkruimdus-auth-token', JSON.stringify({
        access_token: 'fake', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake',
        user: {
          id: '00000000-0000-0000-0000-000000000000', email: 'qa@example.com',
          aud: 'authenticated', role: 'authenticated',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
        },
      })));
      await ap.reload({ waitUntil: 'domcontentloaded' });
      await ap.waitForTimeout(2400);
      await ap.evaluate(() => {
        document.getElementById('splashScreen')?.remove();
        document.querySelector('.tab[data-section="map"], .mtab[data-section="map"]')?.click();
      });
      await ap.waitForSelector('.map-spot[data-spot-no="2"]', { state: 'attached', timeout: 8000 });
      await ap.evaluate(() => document.querySelector('.map-spot[data-spot-no="2"]').click());
      await ap.waitForSelector('#uiDialogPick .ui-pick-row', { timeout: 5000 });

      const open = await ap.evaluate(() => ({
        title: document.getElementById('uiDialogMessage').textContent,
        rows: document.querySelectorAll('.ui-pick-row').length,
        note: document.getElementById('uiDialogPickNote').textContent,
        text: document.getElementById('uiDialogPickList').textContent,
        ok: getComputedStyle(document.getElementById('uiDialogOk')).display,
        cancel: getComputedStyle(document.getElementById('uiDialogCancel')).display,
      }));
      // A car that already has a spot cannot be put on a second one.
      check('assign-offers-only-cars-without-a-spot',
        open.rows > 0 && !/PLACED1|Porsche/.test(open.text), JSON.stringify({ rows: open.rows }));
      // Forty rows is a list; four hundred is a scroll bar. The rest are behind
      // the search box, and the note is what says so instead of leaving the
      // reader to guess the list is all there is.
      check('assign-caps-the-rows-and-says-how-many-more',
        open.rows === 40 && /\b10\b/.test(open.note), JSON.stringify({ rows: open.rows, note: open.note }));
      // Picking a name is the answer; a confirm button would ask it twice.
      check('assign-has-no-confirm-button', open.ok === 'none' && open.cancel !== 'none',
        JSON.stringify({ ok: open.ok, cancel: open.cancel }));

      await ap.fill('#uiDialogPickSearch', 'vlad');
      await ap.waitForTimeout(200);
      const byName = await ap.evaluate(() => ({
        rows: document.querySelectorAll('.ui-pick-row').length,
        text: document.getElementById('uiDialogPickList').textContent,
      }));
      check('assign-search-narrows-the-list',
        byName.rows > 0 && byName.rows < 40 && /Vlad Ene/.test(byName.text) && !/Ana Pop/.test(byName.text),
        JSON.stringify({ rows: byName.rows }));

      // The plate is the fastest thing to type with the car in front of you and
      // the slowest to read off a list, so it is searchable without being the
      // line you read.
      await ap.fill('#uiDialogPickSearch', 'B137XYZ');
      await ap.waitForTimeout(200);
      const byPlate = await ap.evaluate(() => ({
        rows: document.querySelectorAll('.ui-pick-row').length,
        main: document.querySelector('.ui-pick-main')?.textContent || '',
        sub: document.querySelector('.ui-pick-sub')?.textContent || '',
      }));
      check('assign-search-matches-a-plate',
        byPlate.rows === 1 && /B137XYZ/.test(byPlate.sub) && !/B137XYZ/.test(byPlate.main),
        JSON.stringify(byPlate));

      // Aiming near a bay is the same intent as landing on one. At fit-width a
      // bay is four pixels across on a laptop and under three on a phone: drawn
      // exactly right, and impossible to hit — which is what "some of them
      // can't be used" turned out to mean.
      await ap.evaluate(() => document.getElementById('uiDialogCancel').click());
      await ap.waitForTimeout(200);
      const near = await ap.evaluate(() => {
        const r = document.querySelector('.map-spot[data-spot-no="2"]').getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2) + 14, y: Math.round(r.top + r.height / 2) - 9 };
      });
      const onNothing = await ap.evaluate(([x, y]) =>
        !document.elementFromPoint(x, y)?.closest('.map-spot'), [near.x, near.y]);
      await ap.mouse.click(near.x, near.y);
      await ap.waitForTimeout(500);
      const beside = await ap.evaluate(() => ({
        shown: document.getElementById('uiDialog').classList.contains('show'),
        title: document.getElementById('uiDialogMessage').textContent,
      }));
      check('map-a-tap-beside-a-bay-still-picks-it',
        onNothing && beside.shown && beside.title === open.title,
        JSON.stringify({ onNothing, beside, wanted: open.title }));

      await ap.fill('#uiDialogPickSearch', 'B137XYZ');
      await ap.waitForTimeout(200);
      await ap.click('.ui-pick-row');
      await ap.waitForTimeout(600);
      const wrote = carPatches.find((c) => /"spot_no":2/.test(c.body.replace(/\s/g, '')));
      check('assign-a-tap-puts-the-car-on-the-spot',
        !!wrote && /id=eq\.137/.test(wrote.url) && /"zone":"Stance"/.test(wrote.body.replace(/\s/g, '')),
        wrote ? wrote.url.split('?')[1] + ' ' + wrote.body : 'no patch');
      check('assign-closes-after-the-tap',
        !(await ap.evaluate(() => document.getElementById('uiDialog').classList.contains('show'))));
    } catch (e) {
      for (const n of ['assign-offers-only-cars-without-a-spot', 'assign-caps-the-rows-and-says-how-many-more',
        'assign-has-no-confirm-button', 'assign-search-narrows-the-list', 'assign-search-matches-a-plate',
        'map-a-tap-beside-a-bay-still-picks-it',
        'assign-a-tap-puts-the-car-on-the-spot', 'assign-closes-after-the-tap']) {
        if (!checks.some((c2) => c2.name === n)) check(n, false);
      }
      console.log(`assign dialog checks: ${e.message}`);
    }
    check('assign-dialog-no-errors', aerrs.length === 0);
    if (aerrs.length) console.log('  assign errors:', aerrs.slice(0, 3));
    await actx.close();
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
    for (const name of ['index', 'register', 'vote', 'agenda', 'feedback', 'plan']) {
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
