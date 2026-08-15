/**
 * i18n guard — fails the build when the locale packs drift apart.
 *
 * Every user-visible string lives in i18n.js under ro/en/ru. It is very easy to
 * add a key to one locale and forget the others (the app then silently falls
 * back to Romanian), or to rename a {placeholder} in one language so the
 * interpolation breaks. This checks both.
 *
 * Run: node scripts/check-i18n.mjs
 */
import { translations } from '../i18n.js';

const BASE = 'ro'; // the reference locale
const locales = Object.keys(translations);
const problems = [];

if (!locales.includes(BASE)) {
  console.error(`✗ missing base locale "${BASE}"`);
  process.exit(1);
}

const placeholders = (s) =>
  [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const baseKeys = Object.keys(translations[BASE]);
const baseSet = new Set(baseKeys);

// 1. Duplicate keys inside a single locale would have been silently collapsed
//    by the object literal, so compare against the raw source instead.
const src = await (await import('node:fs/promises')).readFile(
  new URL('../i18n.js', import.meta.url), 'utf8');
for (const loc of locales) {
  const seen = new Map();
  // Scan only this locale's block.
  const start = src.indexOf(`\n      ${loc}: {`);
  if (start === -1) continue;
  let depth = 0, i = src.indexOf('{', start), end = src.length;
  for (let p = i; p < src.length; p++) {
    if (src[p] === '{') depth++;
    else if (src[p] === '}') { depth--; if (depth === 0) { end = p; break; } }
  }
  const block = src.slice(start, end);
  for (const m of block.matchAll(/^\s*"([^"]+)"\s*:/gm)) {
    const k = m[1];
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (const [k, n] of seen) {
    if (n > 1) problems.push(`[${loc}] duplicate key "${k}" (${n}×) — the later one silently wins`);
  }
}

// 2. Key sets must match across locales, and placeholders must be identical.
for (const loc of locales) {
  if (loc === BASE) continue;
  const keys = new Set(Object.keys(translations[loc]));
  for (const k of baseKeys) {
    if (!keys.has(k)) problems.push(`[${loc}] missing key "${k}"`);
  }
  for (const k of keys) {
    if (!baseSet.has(k)) problems.push(`[${loc}] extra key "${k}" (not in ${BASE})`);
  }
  for (const k of baseKeys) {
    if (!keys.has(k)) continue;
    const a = placeholders(translations[BASE][k]);
    const b = placeholders(translations[loc][k]);
    if (a !== b) problems.push(`[${loc}] "${k}" placeholders differ: ${BASE}={${a}} vs ${loc}={${b}}`);
  }
}

// 3. Empty values are almost always a mistake.
for (const loc of locales) {
  for (const [k, v] of Object.entries(translations[loc])) {
    if (typeof v !== 'string' || v.trim() === '') problems.push(`[${loc}] empty value for "${k}"`);
  }
}

if (problems.length) {
  console.error(`✗ i18n check failed (${problems.length} problem(s)):`);
  for (const p of problems.slice(0, 60)) console.error('  - ' + p);
  if (problems.length > 60) console.error(`  … and ${problems.length - 60} more`);
  process.exit(1);
}

console.log(`✓ i18n OK — ${locales.length} locales (${locales.join(', ')}), ${baseKeys.length} keys each`);
