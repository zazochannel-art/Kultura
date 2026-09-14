/**
 * Renders the MONEYFLOW app icons.
 *
 * Committing generated PNGs is normal; committing a script that can regenerate
 * them is what makes the mark editable. No image dependency — a PNG is a few
 * zlib-compressed scanlines, and pulling in a canvas library to draw four
 * rectangles would cost more than it saves.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'icons');

const BACKGROUND = [0x09, 0x09, 0x0b];
const BARS = [
  { color: [0x06, 0xb6, 0xd4], heightRatio: 0.34 },
  { color: [0x22, 0xc5, 0x5e], heightRatio: 0.52 },
  { color: [0x8b, 0x5c, 0xf6], heightRatio: 0.74 },
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Distance-to-edge coverage for a rounded rectangle, for cheap antialiasing. */
function roundedRectCoverage(x, y, left, top, right, bottom, radius) {
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.hypot(dx, dy);

  if (x < left - 0.5 || x > right + 0.5 || y < top - 0.5 || y > bottom + 0.5) return 0;
  return Math.min(1, Math.max(0, radius + 0.5 - distance));
}

function draw(size, { fullBleed }) {
  const raw = Buffer.alloc(size * (size * 4 + 1));

  // Maskable icons are cropped to a circle by some launchers, so the glyph sits
  // inside the safe zone while the background runs edge to edge.
  const inset = fullBleed ? 0 : size * 0.06;
  const cornerRadius = fullBleed ? 0 : size * 0.22;

  const glyphScale = fullBleed ? 0.52 : 0.62;
  const glyphWidth = size * glyphScale;
  const glyphLeft = (size - glyphWidth) / 2;
  const baseline = size / 2 + (size * glyphScale) / 2.6;
  const gap = glyphWidth * 0.1;
  const barWidth = (glyphWidth - gap * (BARS.length - 1)) / BARS.length;
  const barRadius = barWidth * 0.3;

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none

    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const offset = rowStart + 1 + x * 4;

      const bgCoverage = roundedRectCoverage(
        px,
        py,
        inset,
        inset,
        size - inset,
        size - inset,
        cornerRadius,
      );

      let r = BACKGROUND[0];
      let g = BACKGROUND[1];
      let b = BACKGROUND[2];
      let a = Math.round(bgCoverage * 255);

      for (let index = 0; index < BARS.length; index += 1) {
        const bar = BARS[index];
        const left = glyphLeft + index * (barWidth + gap);
        const top = baseline - glyphWidth * bar.heightRatio;
        const coverage = roundedRectCoverage(
          px,
          py,
          left,
          top,
          left + barWidth,
          baseline,
          barRadius,
        );
        if (coverage <= 0) continue;

        r = Math.round(r * (1 - coverage) + bar.color[0] * coverage);
        g = Math.round(g * (1 - coverage) + bar.color[1] * coverage);
        b = Math.round(b * (1 - coverage) + bar.color[2] * coverage);
        a = Math.max(a, Math.round(coverage * 255));
      }

      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  return encodePng(size, raw);
}

/** An .ico can simply wrap a PNG, which saves hand-rolling a BMP encoder. */
function wrapPngInIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; // width  (0 means 256)
  entry[1] = size >= 256 ? 0 : size; // height
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32BE(png.length, 8);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), draw(size, { fullBleed: false }));
  writeFileSync(join(outDir, `maskable-${size}.png`), draw(size, { fullBleed: true }));
}
const small = draw(32, { fullBleed: false });
writeFileSync(join(outDir, 'icon-32.png'), small);

// The browser asks for /favicon.ico on the static offline page, where Next's
// metadata does not apply.
writeFileSync(join(here, '..', 'public', 'favicon.ico'), wrapPngInIco(small, 32));
// Next's `app/icon.png` convention covers every app route.
writeFileSync(join(here, '..', 'src', 'app', 'icon.png'), small);

console.log('icons written to public/icons, public/favicon.ico and src/app/icon.png');
