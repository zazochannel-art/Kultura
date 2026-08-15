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
} from '../utils.js';

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
  // Anything older than a day falls through to an absolute date.
  const old = new Date(now - 5 * 86400 * 1000).toISOString();
  assert.equal(fmtRelative(old), fmtDateTime(old));
});

test('fmtDateTime tolerates junk input', () => {
  assert.equal(fmtDateTime(''), '—');
  assert.equal(fmtDateTime(null), '—');
  assert.equal(fmtDateTime('not-a-date'), 'not-a-date');
});
