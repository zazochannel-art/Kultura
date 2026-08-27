"""Vectorise the reference car drawing into the SVG paths app.js draws with.

Run it when `docs/car-top.jpg` changes; paste the four constants it prints into
the artwork block in `app.js`. Four hand-drawn passes at that picture each got
closer and none got there, which is why the picture is the source of truth.

    python3 scripts/trace-car.py [epsilon] [min-area] > car.txt

`epsilon` is the Douglas-Peucker tolerance in source pixels — larger means
fewer points and a coarser outline. Defaults are what shipped.



Line art on white: split into three masks (black line work, grey pillar
shading, red lamps), walk the boundary between filled and empty cells to get
closed loops, simplify them, and emit one path per layer.
"""
import os, sys, numpy as np
from PIL import Image

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'car-top.jpg')
im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.int32)
R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
lum = (R * 299 + G * 587 + B * 114) // 1000
mx = a.max(axis=2); mn = a.min(axis=2)
sat = mx - mn

red   = (R > 110) & (R - G > 45) & (R - B > 45)
black = (lum < 120) & ~red
grey  = (lum >= 120) & (lum < 216) & (sat < 45) & ~red & ~black
print('px  black %d  grey %d  red %d' % (black.sum(), grey.sum(), red.sum()), file=sys.stderr)

def loops(mask):
    """Closed boundary loops of a binary mask, on the pixel-corner grid."""
    m = np.zeros((mask.shape[0] + 2, mask.shape[1] + 2), bool)
    m[1:-1, 1:-1] = mask
    edges = {}
    ys, xs = np.nonzero(m)
    for y, x in zip(ys.tolist(), xs.tolist()):
        # Directed so the filled cell is on the left; loops then close up.
        if not m[y - 1, x]: edges.setdefault((x + 1, y), []).append((x, y))
        if not m[y + 1, x]: edges.setdefault((x, y + 1), []).append((x + 1, y + 1))
        if not m[y, x - 1]: edges.setdefault((x, y), []).append((x, y + 1))
        if not m[y, x + 1]: edges.setdefault((x + 1, y + 1), []).append((x + 1, y))
    out = []
    while edges:
        start = next(iter(edges))
        path = [start]
        cur = start
        while True:
            nxt = edges.get(cur)
            if not nxt: break
            step = nxt.pop()
            if not nxt: del edges[cur]
            path.append(step)
            cur = step
            if cur == start: break
        if len(path) > 8: out.append(path)
    return out

def _rdp_open(pts, eps):
    """Douglas-Peucker on an open polyline."""
    if len(pts) < 3: return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1: continue
        x1, y1 = pts[i]; x2, y2 = pts[j]
        dx, dy = x2 - x1, y2 - y1
        n = (dx * dx + dy * dy) ** 0.5
        best, bi = -1.0, i
        for k in range(i + 1, j):
            x0, y0 = pts[k]
            d = (abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / n) if n else \
                (((x0 - x1) ** 2 + (y0 - y1) ** 2) ** 0.5)
            if d > best: best, bi = d, k
        if best > eps:
            keep[bi] = True
            stack.append((i, bi)); stack.append((bi, j))
    return [q for q, k in zip(pts, keep) if k]

def rdp(ring, eps):
    """Douglas-Peucker on a closed ring.

    Anchored on two far-apart points first: run straight through, the ring's
    first and last point are the same one, the baseline has no length and every
    distance comes out zero — which quietly reduces every contour to two
    points and the whole trace to nothing.
    """
    r = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring[:]
    if len(r) < 4: return r
    x0, y0 = r[0]
    far = max(range(len(r)), key=lambda i: (r[i][0] - x0) ** 2 + (r[i][1] - y0) ** 2)
    a1 = _rdp_open(r[:far + 1], eps)
    a2 = _rdp_open(r[far:] + [r[0]], eps)
    return a1[:-1] + a2[:-1]

def area(p):
    s = 0.0
    for i in range(len(p)):
        x1, y1 = p[i]; x2, y2 = p[(i + 1) % len(p)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2

# The car's own extent, taken off everything that is drawn.
ink = black | grey | red
ys, xs = np.nonzero(ink)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
print('bbox x %d..%d  y %d..%d  (%d x %d)' % (x0, x1, y0, y1, x1 - x0, y1 - y0), file=sys.stderr)

# Nose-left in the picture, nose-up in the bay: a true 90 degree turn, not a
# transpose, or the car comes out mirrored. Length maps to 88 of the 100 units,
# and the width keeps the same scale so nothing is stretched.
L = float(x1 - x0)
k = 88.0 / L
W = (y1 - y0) * k
def put(px, py):
    return (25.0 + ((y1 - py) - (y1 - y0) / 2.0) * k, 6.0 + (px - x0) * k)
print('local width %.2f of 50' % W, file=sys.stderr)

def layer(mask, eps, minarea):
    d = []
    for lp in loops(mask):
        if area(lp) < minarea: continue
        s = rdp(lp, eps)
        if len(s) < 3: continue
        pts = [put(px, py) for px, py in s]
        d.append('M' + 'L'.join('%.2f %.2f' % p for p in pts) + 'Z')
    return ''.join(d)

# The car's silhouette: everything the outline encloses, so a taken bay can be
# painted its zone's colour under the line work. Taken from the drawing itself
# rather than drawn again — the two would drift apart at the first edit.
def silhouette(ink):
    m = np.zeros((ink.shape[0] + 2, ink.shape[1] + 2), bool)
    m[1:-1, 1:-1] = ink
    # Flood the background in from the border; what it cannot reach is the car.
    seen = np.zeros_like(m)
    stack = [(0, 0)]
    seen[0, 0] = True
    H, W2 = m.shape
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W2 and not seen[ny, nx] and not m[ny, nx]:
                seen[ny, nx] = True
                stack.append((ny, nx))
    return (~seen)[1:-1, 1:-1]

EPS = float(sys.argv[1]) if len(sys.argv) > 1 else 1.6
MIN = float(sys.argv[2]) if len(sys.argv) > 2 else 26
silh = silhouette(ink)
print('silhouette px %d' % silh.sum(), file=sys.stderr)
for name, mask, mn2 in (('SILH', silh, MIN * 40), ('BLACK', black, MIN),
                        ('GREY', grey, MIN * 4), ('RED', red, MIN * 4)):
    d = layer(mask, EPS, mn2)
    print('%s|%s' % (name, d))
    print('  %-5s %6d chars' % (name, len(d)), file=sys.stderr)
