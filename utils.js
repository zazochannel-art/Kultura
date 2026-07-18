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
