// Self-contained UI effects: haptics + celebratory/ambient animations.
// These touch only the DOM and the OS "reduce motion" setting — never app
// state, the DB, or i18n — so they live outside app.js and can be reused.
import { reduceMotion } from './utils.js';

// Short haptic tap (no-op where unsupported).
export function haptic(ms = 25) {
  try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {}
}

// Celebratory confetti burst from the upper third of the screen.
export function confettiBurst() {
  if (reduceMotion()) return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti-canvas';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
  const N = 130, cx = W / 2, cy = H * 0.32;
  const parts = Array.from({ length: N }, () => {
    const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 7;
    return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
      w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0], life: 0 };
  });
  const t0 = performance.now();
  (function frame(now) {
    const dt = Math.min(32, now - (frame._l || now)); frame._l = now;
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      p.vy += 0.14 * (dt / 16); p.vx *= 0.99;
      p.x += p.vx * (dt / 16); p.y += p.vy * (dt / 16); p.rot += p.vr; p.life = now - t0;
      const alpha = Math.max(0, 1 - p.life / 1400);
      if (alpha > 0 && p.y < H + 20) alive = true;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (alive) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

// Animated success checkmark (e.g. task completed).
export function successCheck() {
  if (reduceMotion()) return;
  const o = document.createElement('div');
  o.className = 'success-check';
  o.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle class="sc-halo" cx="32" cy="32" r="30"></circle>
    <circle class="sc-circle" cx="32" cy="32" r="27"></circle>
    <path class="sc-check" d="M20 33l8 8 16-17"></path>
  </svg>`;
  document.body.appendChild(o);
  requestAnimationFrame(() => o.classList.add('done'));
  setTimeout(() => o.remove(), 1500);
}

// Ambient aurora briefly intensifies ("someone arrived").
let _auroraT = null;
export function auroraPulse() {
  const a = document.querySelector('.app-aurora');
  if (!a || reduceMotion()) return;
  a.classList.add('pulse');
  clearTimeout(_auroraT);
  _auroraT = setTimeout(() => a.classList.remove('pulse'), 1500);
}
