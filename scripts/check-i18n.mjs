/**
 * i18n guard — fails the build when the locale packs drift apart.
 *
 * Every user-visible string lives in i18n/<lang>.js. It is very easy to add a
 * key to one locale and forget the others (the app then silently falls back to
 * Romanian), or to rename a {placeholder} in one language so the interpolation
 * breaks. This checks both.
 *
 * Since the packs are now loaded on demand at runtime, this also pins the
 * registry: every language i18n.js advertises must have a pack on disk, and
 * every pack must be advertised.
 *
 * Run: node scripts/check-i18n.mjs
 */
import { readFile } from 'node:fs/promises';
import { SUPPORTED_LANGS } from '../i18n.js';

const BASE = 'ro'; // the reference locale
const problems = [];

if (!SUPPORTED_LANGS.includes(BASE)) {
  console.error(`✗ missing base locale "${BASE}" in SUPPORTED_LANGS`);
  process.exit(1);
}

// Load every advertised pack directly — importing i18n.js only gives us the
// statically-bundled Romanian one.
const packs = {};
for (const loc of SUPPORTED_LANGS) {
  const url = new URL(`../i18n/${loc}.js`, import.meta.url);
  try {
    packs[loc] = (await import(url)).default;
  } catch (e) {
    problems.push(`[${loc}] advertised in SUPPORTED_LANGS but i18n/${loc}.js failed to load: ${e.message}`);
  }
}
if (problems.length) {
  console.error('✗ i18n check failed:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

const locales = Object.keys(packs);

const placeholders = (s) =>
  [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const baseKeys = Object.keys(packs[BASE]);
const baseSet = new Set(baseKeys);

// 1. Duplicate keys inside a single pack would have been silently collapsed by
//    the object literal, so compare against the raw source instead.
for (const loc of locales) {
  const src = await readFile(new URL(`../i18n/${loc}.js`, import.meta.url), 'utf8');
  const seen = new Map();
  for (const m of src.matchAll(/^\s*"([^"]+)"\s*:/gm)) {
    seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  }
  for (const [k, n] of seen) {
    if (n > 1) problems.push(`[${loc}] duplicate key "${k}" (${n}×) — the later one silently wins`);
  }
}

// 2. Key sets must match across locales, and placeholders must be identical.
for (const loc of locales) {
  if (loc === BASE) continue;
  const keys = new Set(Object.keys(packs[loc]));
  for (const k of baseKeys) {
    if (!keys.has(k)) problems.push(`[${loc}] missing key "${k}"`);
  }
  for (const k of keys) {
    if (!baseSet.has(k)) problems.push(`[${loc}] extra key "${k}" (not in ${BASE})`);
  }
  for (const k of baseKeys) {
    if (!keys.has(k)) continue;
    const a = placeholders(packs[BASE][k]);
    const b = placeholders(packs[loc][k]);
    if (a !== b) problems.push(`[${loc}] "${k}" placeholders differ: ${BASE}={${a}} vs ${loc}={${b}}`);
  }
}

// 3. Empty values are almost always a mistake.
for (const loc of locales) {
  for (const [k, v] of Object.entries(packs[loc])) {
    if (typeof v !== 'string' || v.trim() === '') problems.push(`[${loc}] empty value for "${k}"`);
  }
}

// 4. The service worker precaches the shell; a pack it doesn't know about
//    would be missing offline for anyone using that language.
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
for (const loc of locales) {
  if (!sw.includes(`i18n/${loc}.js`)) {
    problems.push(`[${loc}] i18n/${loc}.js is not in the sw.js precache list — it won't be available offline`);
  }
}

if (problems.length) {
  console.error(`✗ i18n check failed (${problems.length} problem(s)):`);
  for (const p of problems.slice(0, 60)) console.error('  - ' + p);
  if (problems.length > 60) console.error(`  … and ${problems.length - 60} more`);
  process.exit(1);
}

console.log(`✓ i18n OK — ${locales.length} locales (${locales.join(', ')}), ${baseKeys.length} keys each, all precached`);
