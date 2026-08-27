/**
 * Unit tests for the pure helpers in utils.js — no browser, no network, no
 * dependencies (uses the built-in node:test runner).
 *
 * Run: node --test tests/
 *
 * These functions are load-bearing: plate normalization drives the blocklist
 * and duplicate detection, statusKey drives every gate/stat surface, and phone
 * normalization decides where SMS actually go. Cheap to test, expensive to get
 * wrong.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escape, normalizePhone, telegramLink, twoInitials, hexToRgba,
  statusKey, normPlateKey, fmtRelative, fmtDateTime,
  mergeById, maxWatermark, overlapFrom, backupAgeHours, gateBurstAction, planDrawingOk
} from '../utils.js';
import { planSpots, itemsSvg, SPOT_W, SPOT_D } from '../plan-render.js';

test('escape neutralises HTML metacharacters', () => {
  assert.equal(escape('<script>alert("x")</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(escape("O'Brien & co"), 'O&#39;Brien &amp; co');
  assert.equal(escape(null), '');
  assert.equal(escape(undefined), '');
  assert.equal(escape(0), '0');
});

test('statusKey buckets free-text DB statuses', () => {
  assert.equal(statusKey('Sosit'), 'sosit');
  assert.equal(statusKey('sosit la poarta A'), 'sosit');
  assert.equal(statusKey('Plecat'), 'plecat');
  assert.equal(statusKey('Invitat'), 'invitat');
  assert.equal(statusKey('altceva'), null);
  assert.equal(statusKey(''), null);
  assert.equal(statusKey(null), null);
});

test('normPlateKey ignores spacing, case and punctuation', () => {
  assert.equal(normPlateKey(' b 100 xyz '), 'B100XYZ');
  assert.equal(normPlateKey('B-100-XYZ'), 'B100XYZ');
  assert.equal(normPlateKey('b100xyz'), 'B100XYZ');
  // Same plate written three ways must collapse to one key — this is what
  // makes the blocklist and duplicate detection actually match.
  const forms = ['CJ 12 ABC', 'cj-12-abc', 'CJ12ABC'];
  assert.equal(new Set(forms.map(normPlateKey)).size, 1);
  assert.equal(normPlateKey(''), '');
  assert.equal(normPlateKey(null), '');
});

test('normalizePhone produces country-coded digits', () => {
  assert.equal(normalizePhone('+373 69 123 456'), '37369123456');
  assert.equal(normalizePhone('0037369123456'), '37369123456');
  assert.equal(normalizePhone('069123456'), '37369123456');
  assert.equal(normalizePhone('69123456'), '37369123456');
  assert.equal(normalizePhone('373 69 123 456'), '37369123456');
  // A leading 0 in front of an existing country code must not double it up.
  assert.equal(normalizePhone('037369123456'), '37369123456');
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone(null), '');
});

test('telegramLink accepts handles, @handles and full URLs', () => {
  assert.equal(telegramLink('@user'), 'https://t.me/user');
  assert.equal(telegramLink('user'), 'https://t.me/user');
  assert.equal(telegramLink('https://t.me/user'), 'https://t.me/user');
  assert.equal(telegramLink('t.me/user'), 'https://t.me/user');
  assert.equal(telegramLink('+37369123456'), 'https://t.me/+37369123456');
  assert.equal(telegramLink(''), '');
  assert.equal(telegramLink('   '), '');
});

test('twoInitials handles one, two and empty names', () => {
  assert.equal(twoInitials('Ion Popescu'), 'IP');
  assert.equal(twoInitials('Ion'), 'IO');
  assert.equal(twoInitials('  Ana   Maria  '), 'AM');
  assert.equal(twoInitials(''), '?');
});

test('hexToRgba converts and falls back safely', () => {
  assert.equal(hexToRgba('#3b82f6', 0.5), 'rgba(59,130,246,0.5)');
  assert.equal(hexToRgba('3b82f6', 1), 'rgba(59,130,246,1)');
  // Anything unparseable must still yield a valid CSS colour, not "NaN".
  assert.equal(hexToRgba('nope', 0.2), 'rgba(59,130,246,0.2)');
  assert.equal(hexToRgba(null, 0.2), 'rgba(59,130,246,0.2)');
});

test('fmtRelative bucketises recent timestamps', () => {
  const now = Date.now();
  assert.match(fmtRelative(new Date(now - 10 * 1000).toISOString()), /secunde/);
  assert.match(fmtRelative(new Date(now - 5 * 60 * 1000).toISOString()), /^acum 5 min$/);
  assert.match(fmtRelative(new Date(now - 3 * 3600 * 1000).toISOString()), /^acum 3 h$/);
  assert.equal(fmtRelative(''), '');
  // Days stay relative for a week — "acum 3 zile" reads better than a full
  // timestamp, and it is what makes a queue sortable by eye.
  assert.equal(fmtRelative(new Date(now - 26 * 3600 * 1000).toISOString()), 'acum o zi');
  assert.equal(fmtRelative(new Date(now - 3 * 86400 * 1000).toISOString()), 'acum 3 zile');
  // Past a week it falls through to an absolute date.
  const old = new Date(now - 9 * 86400 * 1000).toISOString();
  assert.equal(fmtRelative(old), fmtDateTime(old));
});

test('fmtDateTime tolerates junk input', () => {
  assert.equal(fmtDateTime(''), '—');
  assert.equal(fmtDateTime(null), '—');
  assert.equal(fmtDateTime('not-a-date'), 'not-a-date');
});

// ----- Incremental sync -----
// These two decide what the operator sees after a poll. A bug here shows up as
// a car that silently stops updating, so the edge cases are worth pinning.

test('mergeById patches existing rows and appends new ones, newest id first', () => {
  const prev = [
    { id: 3, plate: 'C', status: 'Invitat' },
    { id: 1, plate: 'A', status: 'Invitat' },
  ];
  const merged = mergeById(prev, [
    { id: 1, plate: 'A', status: 'Sosit' },   // changed
    { id: 2, plate: 'B', status: 'Invitat' }, // new
  ]);
  assert.deepEqual(merged.map(r => r.id), [3, 2, 1]);
  assert.equal(merged.find(r => r.id === 1).status, 'Sosit');
  assert.equal(merged.find(r => r.id === 3).status, 'Invitat');
});

test('mergeById keeps columns the delta does not carry', () => {
  // The list fetch omits heavy columns that the detail view hydrated earlier;
  // a delta must not wipe them.
  const prev = [{ id: 1, plate: 'A', status: 'Invitat', notes: 'hydrated' }];
  const merged = mergeById(prev, [{ id: 1, plate: 'A', status: 'Sosit' }]);
  assert.equal(merged[0].notes, 'hydrated');
  assert.equal(merged[0].status, 'Sosit');
});

test('mergeById is idempotent and handles empty input', () => {
  const prev = [{ id: 1, status: 'Sosit' }];
  const once = mergeById(prev, [{ id: 1, status: 'Sosit' }]);
  const twice = mergeById(once, [{ id: 1, status: 'Sosit' }]);
  assert.deepEqual(once, twice);
  assert.deepEqual(mergeById(prev, []), prev);
  assert.deepEqual(mergeById(null, []), []);
  // Ids arriving as strings must not create a duplicate row.
  assert.equal(mergeById([{ id: 1 }], [{ id: '1', status: 'Sosit' }]).length, 1);
});

test('maxWatermark advances only forwards', () => {
  const rows = [
    { id: 1, updated_at: '2026-08-15T10:00:00.000Z' },
    { id: 2, updated_at: '2026-08-15T12:00:00.000Z' },
    { id: 3, updated_at: '2026-08-15T11:00:00.000Z' },
  ];
  assert.equal(maxWatermark(null, rows), '2026-08-15T12:00:00.000Z');
  // An older batch must never rewind the watermark, or rows would be re-sent
  // forever.
  assert.equal(maxWatermark('2026-08-15T13:00:00.000Z', rows), '2026-08-15T13:00:00.000Z');
  // An empty delta (the common idle case) leaves it untouched.
  assert.equal(maxWatermark('2026-08-15T13:00:00.000Z', []), '2026-08-15T13:00:00.000Z');
  // Nothing to anchor on yet — stays null so the caller keeps doing full fetches.
  assert.equal(maxWatermark(null, []), null);
  assert.equal(maxWatermark(null, [{ id: 1 }]), null);
});

test('backupAgeHours reads the newest stamp out of the filenames', () => {
  const now = Date.parse('2026-08-15T20:00:00Z');
  const f = (n) => ({ name: n });
  // Newest wins regardless of list order.
  assert.equal(backupAgeHours([
    f('kultura-backup-2026-08-13T03-17-02-603Z.json'),
    f('kultura-backup-2026-08-15T18-00-00-000Z.json'),
    f('kultura-backup-2026-08-14T03-17-03-650Z.json'),
  ], now), 2);
  // Nothing to go on → null, which the caller renders as "no backups at all"
  // rather than as a fresh one.
  assert.equal(backupAgeHours([], now), null);
  assert.equal(backupAgeHours(null, now), null);
  assert.equal(backupAgeHours([f('not-a-backup.json')], now), null);
  // A stale set must read as stale, not be rescued by an unparseable sibling.
  const stale = backupAgeHours([f('kultura-backup-2026-08-10T03-17-00-000Z.json'), f('junk')], now);
  assert.ok(stale > 26, `expected a stale age, got ${stale}`);
});

test('overlapFrom rewinds the watermark by the safety margin', () => {
  assert.equal(
    overlapFrom('2026-08-15T12:00:30.000Z', 15000),
    '2026-08-15T12:00:15.000Z');
  // Postgres' space-separated rendering must not silently disable the overlap.
  assert.equal(
    overlapFrom('2026-08-15 12:00:30.000+00:00', 15000),
    '2026-08-15T12:00:15.000Z');
  // The rewind must always go backwards — a forward skew would skip rows.
  const wm = '2026-08-15T12:00:30.000Z';
  assert.ok(Date.parse(overlapFrom(wm, 15000)) < Date.parse(wm));
  // Unparseable input falls back to querying from the mark itself rather than
  // from "Invalid Date", which the server would reject outright.
  assert.equal(overlapFrom('junk', 15000), 'junk');
  assert.equal(overlapFrom(null, 15000), null);
});

test('gateBurstAction keeps the two expensive cases off the fast path', () => {
  // The normal case: wave them through without stopping the camera.
  assert.equal(gateBurstAction('invitat', false), 'checkin');
  // No status yet is still a car that has not arrived.
  assert.equal(gateBurstAction('', false), 'checkin');
  assert.equal(gateBurstAction(null, false), 'checkin');

  // Already inside: acknowledge, but write nothing. Re-stamping would move the
  // arrival time and hide when the car actually turned up.
  assert.equal(gateBurstAction('sosit', false), 'dup');

  // A blocklisted plate is the one car somebody has to look at — it must stop
  // the camera even when it has not arrived yet, and even if already inside.
  assert.equal(gateBurstAction('invitat', true), 'card');
  assert.equal(gateBurstAction('sosit', true), 'card');
  assert.equal(gateBurstAction('', true), 'card');

  // Anything we do not recognise is not something to guess at while waving
  // cars through.
  assert.equal(gateBurstAction('plecat', false), 'card');
  assert.equal(gateBurstAction('nonsense', false), 'card');
});

// The app draws a car on every bay of the venue plan, sized and turned to sit
// in it. That only works while `planSpots` and the renderer agree on what the
// angle of a bay means — and they are read by two different files, so nothing
// complains when they drift. An earlier version reported the heading of the car
// instead of the rotation of the bay, ninety degrees apart, which put every car
// across the lines it was parked between.
test('planSpots reports the angle the drawing actually uses', () => {
  const plan = { items: [{ id: 'r1', t: 'row', zone: 'A', a: [0, 0], b: [10, 10], n: 2, start: 1 }] };
  const spots = planSpots(plan);
  assert.equal(spots.length, 2);
  assert.equal(Math.round(spots[0].rot), 45);

  // Not "45 is the right number" but "45 is what the bay is drawn at".
  const svg = itemsSvg(plan, 10, { flat: true });
  const turns = [...svg.matchAll(/rotate\((-?[\d.]+)\)/g)].map((m) => +m[1]);
  assert.equal(turns.length, 2);
  for (const a of turns) assert.equal(a, Math.round(spots[0].rot * 100) / 100);
});

test('planSpots reports the size of each bay, packing them when a row is full', () => {
  // A ten-metre row of two bays: each gets its full 2.5 m.
  const roomy = planSpots({ items: [{ id: 'r', t: 'row', a: [0, 0], b: [10, 0], n: 2, start: 1 }] });
  assert.equal(roomy[0].sw, SPOT_W);
  assert.equal(roomy[0].sd, SPOT_D);
  // The same row asked for ten bays cannot give them 2.5 m each, so they narrow
  // rather than overlap — and a car drawn on one has to narrow with it.
  const packed = planSpots({ items: [{ id: 'r', t: 'row', a: [0, 0], b: [10, 0], n: 10, start: 1 }] });
  assert.ok(packed[0].sw < SPOT_W, String(packed[0].sw));
  assert.ok(packed[0].sw <= 1, String(packed[0].sw));
});

// The plan a map is drawn from is fetched by the app, from an address kept in a
// row anyone with staff rights can edit. So the address is checked against what
// is ours, not against what looks wrong.
test('a plan drawing is fetched only from our own two sources', () => {
  const bucket = 'https://knphmxxokowwkruimdus.supabase.co/storage/v1/object/public/plans/';

  // Ours: shipped with the app, or uploaded to our bucket.
  assert.equal(planDrawingOk('plans/plan-06.json', bucket), true);
  assert.equal(planDrawingOk(bucket + '1756-abc.json', bucket), true);

  // Somebody else's host, however plausible the path.
  assert.equal(planDrawingOk('https://evil.example/plans/plan-06.json', bucket), false);
  assert.equal(planDrawingOk('//evil.example/plan.json', bucket), false);
  // A near miss on our own host is still not our bucket.
  assert.equal(planDrawingOk('https://knphmxxokowwkruimdus.supabase.co/storage/v1/object/public/backups/x.json', bucket), false);

  // Climbing out, on either branch.
  assert.equal(planDrawingOk('../secrets.json', bucket), false);
  assert.equal(planDrawingOk(bucket + '../../backups/dump.json', bucket), false);

  // Absolute paths and anything that is not a plan file.
  assert.equal(planDrawingOk('/etc/passwd.json', bucket), false);
  assert.equal(planDrawingOk('plans/plan-06.js', bucket), false);
  assert.equal(planDrawingOk('', bucket), false);
  assert.equal(planDrawingOk(null, bucket), false);
});
