// Pure, dependency-free helpers shared across the app.
// Kept out of app.js so the main module stays smaller and these can be reused
// and tested in isolation. Nothing here touches app state, the DB, or the DOM
// tree beyond creating throwaway elements.

// HTML-escape a value for safe interpolation into innerHTML.
export function escape(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

// True when the user asked the OS to reduce motion.
export const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Normalize a phone number to country-coded digits (Moldova 373 default).
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d.slice(1).replace(/\D/g, '');
  d = d.replace(/\D/g, '');
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('373')) return d;
  if (d.startsWith('0')) {
    const rest = d.slice(1);
    return rest.startsWith('373') ? rest : '373' + rest; // 0 + local (guard double-code)
  }
  if (d.length >= 7 && d.length <= 9) return '373' + d;  // bare local number
  return d;
}

// Turn whatever is stored in `telegram` into a t.me link, or '' if empty.
// Accepts a bare @username, a username, or a full t.me/... URL.
export function telegramLink(raw) {
  let v = (raw || '').trim();
  if (!v) return '';
  const m = v.match(/(?:t\.me\/|telegram\.me\/)(.+)$/i);
  if (m) v = m[1];
  v = v.replace(/^@/, '').replace(/\s+/g, '');
  if (!v) return '';
  // A phone-style value (only digits / leading +) uses the +number form.
  if (/^\+?\d[\d\s]*$/.test(v)) return `https://t.me/+${v.replace(/\D/g, '')}`;
  return `https://t.me/${encodeURIComponent(v)}`;
}

// Deterministic hue from a name so the same person keeps the same color.
export function nameHue(name) {
  let h = 0; const s = String(name || '?');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
// Inline style for a colored initials avatar.
export function avatarBg(name) {
  const h = nameHue(name);
  return `background:linear-gradient(135deg,hsl(${h} 70% 52%),hsl(${(h + 40) % 360} 68% 44%));color:#fff;`;
}
// Up to two initials from a name.
export function twoInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const s = parts.length >= 2 ? parts[0][0] + parts[1][0] : (name || '?').substring(0, 2);
  return s.toUpperCase();
}

// hex → rgba (for event-derived accent glow).
export function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return `rgba(59,130,246,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Canonical car status bucket from a free-text DB status ('sosit' / 'plecat'
// / 'invitat'), or null when it matches none.
export function statusKey(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('sosit')) return 'sosit';
  if (s.includes('plecat')) return 'plecat';
  if (s.includes('invitat')) return 'invitat';
  return null;
}

// Normalize a plate to a comparison key (uppercase, strip non-alphanumerics,
// Latin + Cyrillic). Used for plate matching / blocklist / duplicate checks.
export const normPlateKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/gi, '');

// Absolute date-time in Romanian locale (used in detail views).
export function fmtDateTime(v) {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return d.toLocaleString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return String(v); }
}

// Short relative time ("acum 5 min"), falling back to an absolute date.
export function fmtRelative(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'acum câteva secunde';
  if (diff < 3600) return `acum ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `acum ${Math.floor(diff / 3600)} h`;
  // Days, up to a week. Without this the line jumped straight from "acum 23 h"
  // to a full "14 august 2026 la 17:45", which is far too heavy for a meta
  // line — and useless for judging queue order at a glance.
  // Capped at 7 so the count never reaches 20, where Romanian would need "de".
  if (diff < 7 * 86400) {
    const d = Math.floor(diff / 86400);
    return d === 1 ? 'acum o zi' : `acum ${d} zile`;
  }
  return fmtDateTime(v);
}

// ----- Incremental sync helpers -----
// Merge a batch of changed rows into a list already held in memory, keyed by
// id and ordered newest id first (what a `order('id', desc)` fetch returns).
// Existing rows are patched, not replaced, so columns hydrated on demand by a
// detail view survive a delta that only carries the list columns.
export function mergeById(prev, rows) {
  const byId = new Map((prev || []).map(r => [String(r.id), r]));
  for (const r of rows || []) {
    const k = String(r.id);
    byId.set(k, byId.has(k) ? { ...byId.get(k), ...r } : r);
  }
  return [...byId.values()].sort((a, b) => Number(b.id) - Number(a.id));
}

// Newest `updated_at` across a batch, or the current watermark when the batch
// carries nothing newer. Timestamps come from the server, so this never
// depends on the device clock. ISO-8601 UTC strings compare correctly as text.
export function maxWatermark(current, rows) {
  let max = current || null;
  for (const r of rows || []) {
    const u = r && r.updated_at;
    if (u && (!max || u > max)) max = u;
  }
  return max;
}

// Age of the newest backup file, in hours — null when there is none.
// Read from the ISO stamp in the filename rather than storage metadata, so a
// file re-uploaded in place can't make a stale backup look fresh.
export function backupAgeHours(files, now = Date.now()) {
  let newest = 0;
  for (const f of files || []) {
    const m = String(f && f.name || '').match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (!m) continue;
    const ts = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
    if (Number.isFinite(ts) && ts > newest) newest = ts;
  }
  return newest ? (now - newest) / 3600000 : null;
}

// Rewind a watermark by `overlapMs` so a delta query also re-reads the rows
// right behind it. `updated_at` is stamped at transaction start but only
// becomes visible at commit, so a slow write can surface with a timestamp the
// watermark already passed. Returns the input untouched if it can't be parsed
// — asking from the raw mark is better than asking from an invalid date.
export function overlapFrom(watermark, overlapMs) {
  const raw = String(watermark || '');
  const t = Date.parse(raw.replace(' ', 'T'));   // tolerate the space-separated form
  if (!Number.isFinite(t)) return watermark;
  return new Date(t - overlapMs).toISOString();
}

// Downscale an image client-side before upload (max side px, JPEG quality).
// Falls back to the original file for formats canvas can't decode (HEIC).
export async function downscaleImage(file, maxSide = 1600, quality = 0.82) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    return blob || file;
  } catch (_) {
    return file;
  }
}

// What a burst-mode gate scan should do with a car, with no side effects so it
// can be reasoned about and tested on its own.
//
//   'card'    → stop the camera and show the confirmation card
//   'dup'     → already inside: acknowledge, write nothing
//   'checkin' → mark arrived and stay live
//
// Two cases deliberately fall back to the card, because being wrong about them
// is expensive: a blocklisted plate is the one car somebody must actually look
// at, and an unknown status is not something to guess at while waving cars
// through. Re-stamping a car that is already inside would move its arrival time
// and hide the real one, so that path writes nothing.
export function gateBurstAction(statusKey, isBlocked) {
  if (isBlocked) return 'card';
  if (statusKey === 'sosit') return 'dup';
  if (statusKey === 'invitat' || !statusKey) return 'checkin';
  return 'card';
}


// Whether a plan's drawing may be fetched from this address. Two sources are
// ours and no others: a file in our own plans bucket, and one shipped with the
// app. Everything else is somebody else's JSON, and the app would be the one
// fetching it — so the check is a whitelist, not a blacklist.
//
// `..` is refused outright, before either branch: a bucket URL is still a URL,
// and a relative path that climbs is not the path it looks like.
export function planDrawingOk(url, bucketPrefix) {
  const u = String(url || '');
  if (!u || u.includes('..')) return false;
  if (bucketPrefix && u.startsWith(bucketPrefix)) return true;
  return /^[\w./-]+\.json$/.test(u) && !u.startsWith('/');
}
