/**
 * Tiny pure-PNG line chart for Workers.
 * No canvas, no external API, no R2 — generate bytes in-memory.
 * Uses CompressionStream (deflate) available on Workers.
 */

export interface ChartPoint {
  ts: number;
  price: number;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  title: string;
  subtitle?: string;
  upColor?: [number, number, number];
  downColor?: [number, number, number];
  bg?: [number, number, number];
}

function crcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const len = u32(data.length);
  const body = new Uint8Array(4 + data.length);
  body.set(typeBytes, 0);
  body.set(data, 4);
  const crc = u32(crc32(body));
  const out = new Uint8Array(4 + body.length + 4);
  out.set(len, 0);
  out.set(body, 4);
  out.set(crc, 4 + body.length);
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  await writer.write(data);
  await writer.close();
  const reader = cs.readable.getReader();
  const parts: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function setPixel(
  rgba: Uint8Array,
  w: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  if (x < 0 || y < 0 || x >= w) return;
  const i = (y * w + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function fillRect(
  rgba: Uint8Array,
  w: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) setPixel(rgba, w, x, y, r, g, b);
  }
}

function line(
  rgba: Uint8Array,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
  thickness = 2,
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    for (let ty = -thickness; ty <= thickness; ty++) {
      for (let tx = -thickness; tx <= thickness; tx++) {
        if (tx * tx + ty * ty <= thickness * thickness) setPixel(rgba, w, x + tx, y + ty, r, g, b);
      }
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Compact 5×7 glyphs (7 rows × 5-bit columns). */
const FONT: Record<string, number[]> = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "0": [0xe, 0x11, 0x13, 0x15, 0x19, 0x11, 0xe],
  "1": [0x4, 0xc, 0x4, 0x4, 0x4, 0x4, 0xe],
  "2": [0xe, 0x11, 0x1, 0x2, 0x4, 0x8, 0x1f],
  "3": [0x1f, 0x2, 0x4, 0x2, 0x1, 0x11, 0xe],
  "4": [0x2, 0x6, 0xa, 0x12, 0x1f, 0x2, 0x2],
  "5": [0x1f, 0x10, 0x1e, 0x1, 0x1, 0x11, 0xe],
  "6": [0x6, 0x8, 0x10, 0x1e, 0x11, 0x11, 0xe],
  "7": [0x1f, 0x1, 0x2, 0x4, 0x8, 0x8, 0x8],
  "8": [0xe, 0x11, 0x11, 0xe, 0x11, 0x11, 0xe],
  "9": [0xe, 0x11, 0x11, 0xf, 0x1, 0x2, 0xc],
  A: [0xe, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0xe, 0x11, 0x10, 0x10, 0x10, 0x11, 0xe],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0xe, 0x11, 0x10, 0x17, 0x11, 0x11, 0xe],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0xe, 0x4, 0x4, 0x4, 0x4, 0x4, 0xe],
  J: [0x1, 0x1, 0x1, 0x1, 0x11, 0x11, 0xe],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0xe, 0x11, 0x11, 0x11, 0x11, 0x11, 0xe],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0xe, 0x11, 0x11, 0x11, 0x15, 0x12, 0xd],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0xe, 0x11, 0x10, 0xe, 0x1, 0x11, 0xe],
  T: [0x1f, 0x4, 0x4, 0x4, 0x4, 0x4, 0x4],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0xe],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0xa, 0x4],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0xa, 0x4, 0xa, 0x11, 0x11],
  Y: [0x11, 0x11, 0xa, 0x4, 0x4, 0x4, 0x4],
  Z: [0x1f, 0x1, 0x2, 0x4, 0x8, 0x10, 0x1f],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "+": [0, 0x4, 0x4, 0x1f, 0x4, 0x4, 0],
  ".": [0, 0, 0, 0, 0, 0x4, 0x4],
  ",": [0, 0, 0, 0, 0x4, 0x4, 0x8],
  ":": [0, 0x4, 0x4, 0, 0x4, 0x4, 0],
  "%": [0x19, 0x1a, 0x4, 0x8, 0xb, 0x13, 0],
  "/": [0x1, 0x2, 0x4, 0x8, 0x10, 0, 0],
  "(": [0x4, 0x8, 0x10, 0x10, 0x10, 0x8, 0x4],
  ")": [0x8, 0x4, 0x2, 0x2, 0x2, 0x4, 0x8],
  K_LOWER: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  M_LOWER: [0, 0, 0x1a, 0x15, 0x15, 0x15, 0x15],
};

function drawText(
  rgba: Uint8Array,
  w: number,
  x: number,
  y: number,
  text: string,
  r: number,
  g: number,
  b: number,
  scale = 2,
): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT[ch.toLowerCase()] ?? FONT[" "]!;
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row] ?? 0;
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              setPixel(rgba, w, cx + col * scale + sx, y + row * scale + sy, r, g, b);
            }
          }
        }
      }
    }
    cx += 6 * scale;
  }
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-US");
}

export async function renderLineChartPng(points: ChartPoint[], opts: ChartOptions): Promise<Uint8Array> {
  const width = opts.width ?? 800;
  const height = opts.height ?? 420;
  const bg = opts.bg ?? [15, 18, 28];
  const pad = { t: 64, r: 24, b: 48, l: 88 };
  const rgba = new Uint8Array(width * height * 4);

  // background
  fillRect(rgba, width, 0, 0, width, height, bg[0], bg[1], bg[2]);

  const prices = points.map((p) => p.price);
  const first = prices[0] ?? 0;
  const last = prices[prices.length - 1] ?? 0;
  const up = last >= first;
  const color = up ? (opts.upColor ?? [46, 204, 113]) : (opts.downColor ?? [231, 76, 60]);

  drawText(rgba, width, 16, 14, opts.title.slice(0, 40), 236, 240, 241, 2);
  if (opts.subtitle) {
    drawText(rgba, width, 16, 36, opts.subtitle.slice(0, 48), 149, 165, 166, 2);
  }

  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;

  if (points.length < 2) {
    drawText(rgba, width, pad.l, pad.t + plotH / 2, "NOT ENOUGH DATA YET", 149, 165, 166, 2);
  } else {
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    // grid
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + Math.round((plotH * i) / 4);
      for (let x = pad.l; x < pad.l + plotW; x += 4) {
        setPixel(rgba, width, x, y, 40, 48, 64);
      }
      const val = max - (span * i) / 4;
      drawText(rgba, width, 8, y - 6, formatCompact(val), 127, 140, 141, 1);
    }

    // line
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1]!;
      const p1 = points[i]!;
      const x0 = pad.l + Math.round(((i - 1) / (points.length - 1)) * plotW);
      const x1 = pad.l + Math.round((i / (points.length - 1)) * plotW);
      const y0 = pad.t + Math.round(((max - p0.price) / span) * plotH);
      const y1 = pad.t + Math.round(((max - p1.price) / span) * plotH);
      line(rgba, width, x0, y0, x1, y1, color[0], color[1], color[2], 2);
    }

    // last point marker
    const lx = pad.l + plotW;
    const ly = pad.t + Math.round(((max - last) / span) * plotH);
    fillRect(rgba, width, lx - 4, ly - 4, 8, 8, color[0], color[1], color[2]);

    const delta = first ? ((last - first) / first) * 100 : 0;
    const deltaStr = `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%  ${formatCompact(last)}`;
    drawText(rgba, width, width - 16 - deltaStr.length * 12, 14, deltaStr, color[0], color[1], color[2], 2);
  }

  // pack PNG
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter none
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowStart + 1);
  }

  const ihdr = new Uint8Array(13);
  ihdr.set(u32(width), 0);
  ihdr.set(u32(height), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = await deflate(raw);
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    png.set(p, o);
    o += p.length;
  }
  return png;
}
