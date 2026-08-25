/**
 * Drawing a plan — the part the editor and the app must agree on.
 *
 * `plan.html` edits plans; the app shows one as its venue map. If each drew its
 * own way they would drift, and a spot would end up in a different place in the
 * two of them — which is the one thing a parking plan may never do. So the
 * geometry and the SVG live here, and both import them.
 *
 * Everything is in metres. Nothing in this file touches the DOM or the network.
 */

export const SPOT_W = 2.5, SPOT_D = 5;          // one parking bay, in metres

export const MARKERS = [
  ['intrare', '🚪', 'Intrare'], ['iesire', '🏁', 'Ieșire'], ['scena', '🎤', 'Scenă'],
  ['food', '🍔', 'Food'], ['wc', '🚻', 'Toalete'], ['medical', '⛑', 'Medical'],
  ['foc', '🧯', 'Stingător'], ['staff', '🎽', 'Staff'], ['foto', '📸', 'Foto'],
  ['reper', '📍', 'Reper'],
];

// A plan traced from an architect's drawing wants to look like that drawing:
// ink on paper, not glowing lines on black. The palette changes the canvas and
// every label colour with it, so text stays readable either way.
export const INK = {
  dark:  { label: '#f8fafc', sub: '#94a3b8', spot: '#f8fafc', bg: '#07080d', grid: '255,255,255' },
  paper: { label: '#0f172a', sub: '#475569', spot: '#0f172a', bg: '#f4f3ee', grid: '15,23,42' },
};
export const inkOf = (plan) => INK[plan && plan.paper ? 'paper' : 'dark'];

// Everything imported from a drawing: it is the ground the plan sits on.
const SCENERY = new Set(['area', 'line']);
export const isScenery = (it) => SCENERY.has(it.t);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (v, n) => Math.round(v * Math.pow(10, n)) / Math.pow(10, n);

// ===== GEOMETRY =============================================================

export function polyArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(a / 2);
}

export function centroid(pts) {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a += f; x += (pts[j][0] + pts[i][0]) * f; y += (pts[j][1] + pts[i][1]) * f;
  }
  // A degenerate ring (three points on a line) has no centroid; the average
  // still puts the label somewhere sensible instead of at NaN.
  if (Math.abs(a) < 1e-9) {
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  }
  a *= 3;
  return [x / a, y / a];
}

// Spots of a row, derived rather than stored: change the count and the row
// re-spaces itself instead of leaving forty stale rectangles behind.
export function rowSpots(it) {
  const [ax, ay] = it.a, [bx, by] = it.b;
  const dx = bx - ax, dy = by - ay;
  const L = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / L, uy = dy / L;          // along the row
  const nx = -uy, ny = ux;                 // across it
  const n = Math.max(1, it.n | 0);
  const pitch = L / n;
  // Never wider than its share of the line: asking for more spots packs them
  // tighter instead of drawing them on top of each other.
  const w = Math.min(it.sw || SPOT_W, pitch * 0.94);
  const d = it.sd || SPOT_D;
  const off = (it.side || 0) * d / 2;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * pitch;
    out.push({
      cx: ax + ux * t + nx * off, cy: ay + uy * t + ny * off,
      ang, w, d, no: (it.start || 1) + i,
    });
  }
  return out;
}

export function spotCount(plan) {
  return plan.items.reduce((n, it) =>
    n + (it.t === 'row' ? Math.max(1, it.n | 0) : it.t === 'spot' ? 1 : 0), 0);
}

// Every spot on the plan, in metres. Rows are expanded here, so a caller never
// has to know that a row is stored as two ends and a count.
//
// `rot` is the bay rectangle's own rotation — the same angle `spotSvg` draws it
// at — so anything laid on top of a spot lines up with the bay under it rather
// than sitting across it.
export function planSpots(plan) {
  const out = [];
  for (const it of plan.items) {
    if (it.t === 'row') {
      for (const s of rowSpots(it)) {
        out.push({ zone: it.zone || '', no: s.no, x: s.cx, y: s.cy, rot: s.ang, sw: s.w, sd: s.d, color: it.color });
      }
    } else if (it.t === 'spot') {
      out.push({ zone: it.zone || '', no: it.no, x: it.x, y: it.y, rot: it.rot || 0,
                 sw: it.sw || SPOT_W, sd: it.sd || SPOT_D, color: it.color });
    }
  }
  return out;
}

// Bounding box of everything drawn — what "fit" and the exports frame.
export function planBounds(plan) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const it of plan.items) {
    if (it.pts) it.pts.forEach((p) => add(p[0], p[1]));
    else if (it.t === 'row') { rowSpots(it).forEach((s) => { const k = Math.max(s.w, s.d) / 2; add(s.cx - k, s.cy - k); add(s.cx + k, s.cy + k); }); }
    else if (it.t === 'spot') { const k = Math.max(it.sw || SPOT_W, it.sd || SPOT_D) / 2; add(it.x - k, it.y - k); add(it.x + k, it.y + k); }
    else if (it.x != null) add(it.x, it.y);
  }
  if (x0 === Infinity) return null;
  return { x0, y0, x1, y1, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

// ===== DRAWING ==============================================================

// A spot rectangle, used by rows and by loose spots alike.
function spotSvg(cx, cy, ang, w, d, label, color, textFill) {
  const f = Math.min(w, d) * 0.38;
  return '<g transform="translate(' + round(cx, 3) + ' ' + round(cy, 3) + ') rotate(' + round(ang, 2) + ')">'
    + '<rect x="' + (-w / 2) + '" y="' + (-d / 2) + '" width="' + w + '" height="' + d + '" rx="' + Math.min(0.4, w / 6) + '"'
    + ' fill="' + color + '" fill-opacity=".18" stroke="' + color + '" stroke-width="' + (w / 22) + '"/>'
    + '<text x="0" y="' + (f * 0.36) + '" font-size="' + f + '" text-anchor="middle" fill="' + textFill + '"'
    + ' font-weight="700" pointer-events="none">' + esc(label) + '</text>'
    + '</g>';
}

/**
 * The whole drawing as SVG markup.
 *
 * `s` is pixels per metre — only the pins and their captions care, because
 * those must keep a readable size while the plan grows underneath them.
 * Everything else is drawn in metres, which is why the same function renders
 * the editor's canvas and the exported file.
 *
 * `opts.only` keeps the imported ground ('scenery') and the things you edit
 * ('live') on separate layers; without it a drag would redraw a few thousand
 * shapes. `opts.sel` is the id drawn as selected, `opts.flat` drops selection
 * entirely (exports have no selection).
 *
 * `opts.metric` draws the imported line work at its real width in metres
 * instead of pinning it to screen pixels. A drawing shown at one size wants
 * hairlines that never vanish; one you zoom into wants a two-metre kerb to look
 * two metres wide at every zoom. The floor keeps the thinnest line visible at
 * whatever scale is being drawn for.
 */
export function itemsSvg(plan, s, opts) {
  const o = opts || {};
  const px = 1 / s;
  const K = inkOf(plan);
  // Screen-pixel strokes, or real ones with a floor of about one pixel.
  const hair = o.metric
    ? (w) => ' stroke-width="' + Math.max(0.8 / s, w || 0.05) + '"'
    : (w) => ' stroke-width="' + Math.max(0.7, (w || 0.05) * s) + '" vector-effect="non-scaling-stroke"';
  let out = '';
  for (const it of plan.items) {
    if (o.only === 'scenery' && !isScenery(it)) continue;
    if (o.only === 'live' && isScenery(it)) continue;
    const on = !o.flat && it.id === o.sel;
    const col = it.color || '#3b82f6';
    if (it.t === 'area') {
      // Hairlines must stay hairlines when you zoom out, the way a CAD viewer
      // draws them — otherwise the whole drawing turns into a blob.
      out += '<polygon data-id="' + it.id + '" points="'
        + it.pts.map((q) => q[0] + ',' + q[1]).join(' ') + '" fill="' + col
        + '" fill-opacity="' + (it.o == null ? 1 : it.o) + '"'
        + (it.s ? ' stroke="' + it.s + '"' + hair(it.w) : ' stroke="none"')
        + (on ? ' stroke="#f8589c" stroke-width="2.5" vector-effect="non-scaling-stroke"' : '')
        + '/>';
      continue;
    }
    if (it.t === 'line') {
      out += '<polyline data-id="' + it.id + '" points="'
        + it.pts.map((q) => q[0] + ',' + q[1]).join(' ') + '" fill="none" stroke="'
        + (on ? '#f8589c' : col) + '"' + hair(it.w)
        + ' stroke-linecap="round" stroke-linejoin="round"/>';
      continue;
    }
    if (it.t === 'zone') {
      const pts = it.pts.map((p) => round(p[0], 3) + ',' + round(p[1], 3)).join(' ');
      const a = polyArea(it.pts);
      const c = centroid(it.pts);
      const f = clamp(Math.sqrt(a) / 13, 0.9, 4.5);
      out += '<polygon data-id="' + it.id + '" points="' + pts + '" fill="' + col + '" fill-opacity="'
        + (on ? '.3' : '.16') + '" stroke="' + col + '" stroke-width="' + (on ? 3 * px : 2 * px)
        + '" stroke-linejoin="round"/>';
      if (it.name) {
        out += '<text x="' + round(c[0], 2) + '" y="' + round(c[1], 2) + '" font-size="' + f
          + '" text-anchor="middle" fill="' + K.label + '" font-weight="800" pointer-events="none">' + esc(it.name) + '</text>';
      }
      out += '<text x="' + round(c[0], 2) + '" y="' + round(c[1] + f * 1.15, 2) + '" font-size="' + (f * 0.62)
        + '" text-anchor="middle" fill="' + K.sub + '" pointer-events="none">' + Math.round(a) + ' m²</text>';
    } else if (it.t === 'lane') {
      const pts = it.pts.map((p) => round(p[0], 3) + ',' + round(p[1], 3)).join(' ');
      out += '<polyline data-id="' + it.id + '" points="' + pts + '" fill="none" stroke="' + col
        + '" stroke-opacity="' + (on ? '.42' : '.24') + '" stroke-width="' + (it.w || 4)
        + '" stroke-linecap="round" stroke-linejoin="round"/>';
      out += '<polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-opacity=".85" stroke-width="'
        + Math.max(0.18, (it.w || 4) / 22) + '" stroke-dasharray="' + (it.w || 4) / 2 + ' ' + (it.w || 4) / 2.4
        + '" stroke-linecap="round" pointer-events="none"/>';
      if (it.name) {
        // Halfway along the line, not at a vertex: a two-point alley would
        // otherwise carry its name on its far end, out in the field.
        const h = it.pts.length / 2, i = Math.floor(h);
        const m = h === i
          ? [(it.pts[i - 1][0] + it.pts[i][0]) / 2, (it.pts[i - 1][1] + it.pts[i][1]) / 2]
          : it.pts[i];
        out += '<text x="' + round(m[0], 2) + '" y="' + round(m[1] - (it.w || 4) * 0.7, 2) + '" font-size="'
          + clamp((it.w || 4) * 0.5, 1, 3) + '" text-anchor="middle" fill="' + K.sub + '" pointer-events="none">'
          + esc(it.name) + '</text>';
      }
    } else if (it.t === 'row') {
      const sp = rowSpots(it);
      out += '<g data-id="' + it.id + '">';
      for (const p of sp) out += spotSvg(p.cx, p.cy, p.ang, p.w, p.d, String(p.no), col, K.spot);
      out += '</g>';
      if (on) {
        out += '<line x1="' + it.a[0] + '" y1="' + it.a[1] + '" x2="' + it.b[0] + '" y2="' + it.b[1]
          + '" stroke="#fff" stroke-opacity=".5" stroke-width="' + px + '" stroke-dasharray="'
          + 6 * px + ' ' + 6 * px + '" pointer-events="none"/>';
      }
      if (it.zone) {
        // At the head of the row rather than over its middle: the middle of a
        // row is also the middle of the zone, and the two labels collided.
        const L = Math.hypot(it.b[0] - it.a[0], it.b[1] - it.a[1]) || 1;
        const d = it.sd || SPOT_D;
        const back = (it.sw || SPOT_W) * 0.9;
        const lx = it.a[0] - (it.b[0] - it.a[0]) / L * back;
        const ly = it.a[1] - (it.b[1] - it.a[1]) / L * back;
        out += '<text x="' + round(lx, 2) + '" y="' + round(ly + d * 0.12, 2) + '" font-size="'
          + clamp(d * 0.34, 1, 3) + '" text-anchor="middle" fill="' + col
          + '" font-weight="800" pointer-events="none">' + esc(it.zone) + '</text>';
      }
    } else if (it.t === 'spot') {
      out += '<g data-id="' + it.id + '">'
        + spotSvg(it.x, it.y, it.rot || 0, it.sw || SPOT_W, it.sd || SPOT_D,
                  String(it.no == null ? 1 : it.no), col, K.spot)
        + '</g>';
    } else if (it.t === 'marker') {
      const m = MARKERS.find((k) => k[0] === it.kind) || MARKERS[MARKERS.length - 1];
      const r0 = 13 * px;
      out += '<g data-id="' + it.id + '" transform="translate(' + round(it.x, 3) + ' ' + round(it.y, 3) + ')">'
        + '<circle r="' + r0 + '" fill="' + col + '" fill-opacity="' + (on ? '1' : '.9')
        + '" stroke="#07080d" stroke-width="' + 2 * px + '"/>'
        + '<text y="' + 5 * px + '" font-size="' + 14 * px + '" text-anchor="middle" pointer-events="none">'
        + m[1] + '</text>'
        + '<text y="' + 27 * px + '" font-size="' + 12 * px + '" text-anchor="middle" fill="' + K.label + '"'
        + ' font-weight="700" pointer-events="none">' + esc(it.name || m[2]) + '</text>'
        + '</g>';
    } else if (it.t === 'text') {
      out += '<text data-id="' + it.id + '" x="' + round(it.x, 3) + '" y="' + round(it.y, 3) + '" font-size="'
        + (it.size || 3) + '" fill="' + col + '" font-weight="800"'
        + ' transform="rotate(' + (it.rot || 0) + ' ' + round(it.x, 3) + ' ' + round(it.y, 3) + ')"'
        + (on ? ' text-decoration="underline"' : '') + '>' + esc(it.text || 'Text') + '</text>';
    }
  }
  return out;
}

/**
 * The plan as a standalone SVG document: no photo, no grid, no selection —
 * what leaves the editor is the drawing, readable on its own sheet of paper.
 *
 * Returns the markup together with the view box it was framed in, because a
 * caller that has to place something on top of this image (the app puts its
 * pins there) needs the same numbers to convert metres into percentages.
 */
export function planSvgDoc(plan, opts) {
  const o = opts || {};
  const b = planBounds(plan) || { x0: -50, y0: -35, w: 100, h: 70 };
  const pad = Math.max(4, Math.max(b.w, b.h) * 0.07);
  // The extra `pad` at the bottom is the strip the footer is written on.
  const foot = o.chrome === false ? 0 : pad;
  const vx = b.x0 - pad, vy = b.y0 - pad, vw = b.w + pad * 2, vh = b.h + pad * 2 + foot;
  const W = o.width || 1600, H = Math.max(200, Math.round(W * vh / vw));
  const s = W / vw;
  const K = inkOf(plan);
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="'
    + round(vx, 2) + ' ' + round(vy, 2) + ' ' + round(vw, 2) + ' ' + round(vh, 2)
    + '" font-family="Inter, Helvetica, Arial, sans-serif">'
    + '<rect x="' + round(vx, 2) + '" y="' + round(vy, 2) + '" width="' + round(vw, 2) + '" height="'
    + round(vh, 2) + '" fill="' + K.bg + '"/>'
    + itemsSvg(plan, s, { flat: true, metric: o.metric });
  if (o.chrome !== false) {
    let bar = 1;
    for (const m of [1, 2, 5, 10, 20, 50, 100, 200, 500]) { bar = m; if (m > vw / 8) break; }
    const fy = vy + vh - pad * 0.35, f = pad * 0.42;
    svg += '<text x="' + round(vx + pad * 0.4, 2) + '" y="' + round(vy + pad * 0.9, 2) + '" font-size="' + (f * 1.3)
      + '" fill="' + K.label + '" font-weight="800">' + esc(plan.name || 'Plan') + '</text>'
      + '<text x="' + round(vx + pad * 0.4, 2) + '" y="' + round(fy - f * 1.5, 2) + '" font-size="' + f
      + '" fill="' + K.sub + '">' + spotCount(plan) + ' ' + esc(o.spotsWord || 'locuri') + '</text>'
      + '<line x1="' + round(vx + pad * 0.4, 2) + '" y1="' + round(fy, 2) + '" x2="' + round(vx + pad * 0.4 + bar, 2)
      + '" y2="' + round(fy, 2) + '" stroke="' + K.label + '" stroke-width="' + (f * 0.16) + '"/>'
      + '<text x="' + round(vx + pad * 0.4 + bar + f * 0.4, 2) + '" y="' + round(fy + f * 0.35, 2) + '" font-size="'
      + (f * 0.85) + '" fill="' + K.sub + '">' + bar + ' m</text>';
  }
  svg += '</svg>';
  return { svg, view: { x: vx, y: vy, w: vw, h: vh }, width: W, height: H };
}
