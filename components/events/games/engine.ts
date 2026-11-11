// Tiny shared toolkit for the Events arcade: a 240×135 logical screen, a 3×5
// bitmap font, the monochrome RISE city backdrop and "Rixel" — the arcade's
// character, drawn straight from the RISEx mark (green tile, split X, two eyes).
// Everything paints whole logical pixels; the canvas is scaled up with
// image-rendering: pixelated, so nothing here should use sub-pixel coordinates.

export const W = 240;
export const H = 135;
export const GROUND = 112;

export const C = {
  bg: "#090c0b",
  far: "#101514",
  mid: "#161c1a",
  near: "#1d2522",
  street: "#232b28",
  line: "#3a4541",
  dim: "#56615d",
  grey: "#8b9691",
  ink: "#e9edf1",
  green: "#2ee88e",
  greenMid: "#22b36e",
  greenDim: "#1c8f5a",
  greenDark: "#0f4a31",
  red: "#e46a7b",
  redDim: "#8f3f4b",
  redDark: "#4a1f27",
  gold: "#d7b563",
  black: "#0b0f0e",
} as const;

export type Ctx = CanvasRenderingContext2D;

export interface Input {
  kind: "primary" | "up" | "down" | "left" | "right";
  /** Logical pointer position; absent for keyboard input. */
  x?: number;
  y?: number;
  /** High-resolution event time (same clock as performance.now()). */
  t: number;
}

export interface GameResult {
  score: number;
  label: string;
}

export interface GameInstance {
  update(dt: number): void;
  draw(g: Ctx): void;
  press(input: Input): void;
  release?(input: Input): void;
  hud(): string;
  /** Non-null once the run is finished. */
  result(): GameResult | null;
}

export interface Bar { o: number; h: number; l: number; c: number }
export interface CandleSet { symbol: string; candles: Bar[] }
export interface GameEnv { candleSets: CandleSet[]; best: number | null }

export interface GameDef {
  id: string;
  title: string;
  tagline: string;
  controls: string;
  lowerIsBetter?: boolean;
  formatScore(score: number): string;
  icon: string[];
  create(env: GameEnv): GameInstance;
}

export function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function frame(g: Ctx, x: number, y: number, w: number, h: number, color: string) {
  rect(g, x, y, w, 1, color);
  rect(g, x, y + h - 1, w, 1, color);
  rect(g, x, y, 1, h, color);
  rect(g, x + w - 1, y, 1, h, color);
}

// ── 3×5 bitmap font ───────────────────────────────────────────
// Each glyph is 15 cells, row by row.
const FONT: Record<string, string> = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
  "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110",
  "4": "101101111001001", "5": "111100110001110", "6": "011100111101111", "7": "111001010010010",
  "8": "111101111101111", "9": "111101111001110",
  ".": "000000000000010", ",": "000000000010100", "!": "010010010000010", "?": "110001010000010",
  "-": "000000111000000", "+": "000010111010000", ":": "000010000010000", "%": "101001010100101",
  "/": "001001010100100", "'": "010010000000000", "=": "000111000111000", "#": "101111101111101",
  "<": "001010100010001", ">": "100010001010100", "(": "010100100100010", ")": "010001001001010",
  "$": "011110010011110",
};

export function textWidth(value: string, scale = 1) {
  return value.length ? (value.length * 4 - 1) * scale : 0;
}

export function text(
  g: Ctx,
  value: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  align: "left" | "center" | "right" = "left",
) {
  const upper = value.toUpperCase();
  const width = textWidth(upper, scale);
  let cursor = Math.round(align === "center" ? x - width / 2 : align === "right" ? x - width : x);
  const top = Math.round(y);
  g.fillStyle = color;
  for (const char of upper) {
    const glyph = FONT[char];
    if (glyph) {
      for (let cell = 0; cell < 15; cell++) {
        if (glyph[cell] === "1") g.fillRect(cursor + (cell % 3) * scale, top + Math.floor(cell / 3) * scale, scale, scale);
      }
    }
    cursor += 4 * scale;
  }
}

// ── sprites ───────────────────────────────────────────────────
export type Palette = Record<string, string>;

export function sprite(g: Ctx, rows: string[], palette: Palette, x: number, y: number, scale = 1) {
  const left = Math.round(x);
  const top = Math.round(y);
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    for (let col = 0; col < line.length; col++) {
      const color = palette[line[col]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(left + col * scale, top + row * scale, scale, scale);
    }
  }
}

// Rixel: the RISEx tile come alive. Rows 3–12 carry the mark as it is drawn in
// the logo — a steep, thick stroke falling left-to-right that breaks in the
// middle, and a thin slash rising through the gap. The eyes sit wide, outside it.
const RIXEL_BODY = [
  "...GGGGGGGGGGGG...",
  "..GGGGGGGGGGGGGG..",
  ".GGGGGGGGGGGGGGGG.",
  ".GGGKKGGGGGGGKGGG.",
  ".GGGKKGGGGGGKGGGG.",
  ".GGGGKKGGGGKGGGGG.",
  ".GGGGKKGGGKGGGGGG.",
  ".GWWGGKKGKGGGGWWG.",
  "DGWKGGGGKGKKGGWKGD",
  "DGGGGGGKGGGKKGGGGD",
  ".GGGGGKGGGGKKGGGG.",
  ".GGGGKGGGGGGKKGGG.",
  ".GGGKGGGGGGGKKGGG.",
  ".GGGGGGGGGGGGGGGG.",
  "..GGGGGGGGGGGGGG..",
  "...DDDDDDDDDDDD...",
];
const RIXEL_LEGS: Record<RixelPose, string[]> = {
  idle: ["....WW......WW....", "....WW......WW...."],
  runA: ["....WW......WW....", "...WW........WW..."],
  runB: [".....WW....WW.....", ".....WW....WW....."],
  jump: ["...WW........WW...", ".................."],
};
export type RixelPose = "idle" | "runA" | "runB" | "jump";
export const RIXEL_W = 18;
export const RIXEL_H = 18;

const RIXEL_LIVE: Palette = { G: C.green, D: C.greenMid, K: C.black, W: C.ink };
const RIXEL_REKT: Palette = { G: C.red, D: C.redDim, K: C.black, W: C.ink };

/** Draws Rixel with its feet resting on `footY`. */
export function rixel(g: Ctx, x: number, footY: number, pose: RixelPose = "idle", rekt = false, scale = 1) {
  const palette = rekt ? RIXEL_REKT : RIXEL_LIVE;
  const top = Math.round(footY) - RIXEL_H * scale;
  sprite(g, RIXEL_BODY, palette, x, top, scale);
  sprite(g, RIXEL_LEGS[pose], palette, x, top + RIXEL_BODY.length * scale, scale);
}

/** A 5×5 RISEx tile — the arcade's pickup and life marker. */
export const TOKEN = ["GGGGG", "GKGKG", "GGKGG", "GKGKG", "GGGGG"];
export function token(g: Ctx, x: number, y: number, on = true) {
  sprite(g, TOKEN, on ? { G: C.green, K: C.black } : { G: C.line, K: C.street }, x, y);
}

// ── backdrop ──────────────────────────────────────────────────
function hash(seed: number) {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function skyline(
  g: Ctx,
  offset: number,
  slot: number,
  base: number,
  range: number,
  wall: string,
  lit: string,
  seed: number,
  groundY: number,
  signs: boolean,
) {
  const first = Math.floor(offset / slot) - 1;
  const count = Math.ceil(W / slot) + 2;
  for (let index = first; index < first + count; index++) {
    const key = index * 7919 + seed;
    const width = slot - 1 - Math.floor(hash(key) * 4);
    const height = Math.floor(base + hash(key + 1) * range);
    const x = Math.round(index * slot - offset);
    const top = groundY - height;
    rect(g, x, top, width, height, wall);
    for (let wy = top + 3; wy < groundY - 3; wy += 4) {
      for (let wx = x + 2; wx < x + width - 2; wx += 3) {
        const spark = hash(key + wx * 31 + wy * 17 - x * 31);
        if (spark > 0.985) rect(g, wx, wy, 1, 2, C.greenDim);
        else if (spark > 0.78) rect(g, wx, wy, 1, 2, lit);
      }
    }
    if (signs && ((index % 7) + 7) % 7 === 3) {
      const signX = x - 1;
      const signY = top + 5;
      rect(g, signX, signY, 23, 9, C.black);
      frame(g, signX, signY, 23, 9, C.greenDark);
      text(g, "RISEX", signX + 2, signY + 2, C.green);
    }
  }
}

/** Monochrome parallax city with a few neon-green lights. `scroll` is in px. */
export function city(g: Ctx, scroll = 0, time = 0, groundY = GROUND) {
  rect(g, 0, 0, W, H, C.bg);
  // drifting pixel debris in the sky
  for (let index = 0; index < 22; index++) {
    const x = (((hash(index * 3 + 11) * W - time * (2 + hash(index) * 4) - scroll * 0.05) % W) + W) % W;
    const y = 6 + hash(index * 3 + 12) * (groundY - 60);
    const size = hash(index * 3 + 13) > 0.7 ? 2 : 1;
    rect(g, x, y, size, size, index % 9 === 0 ? C.greenDark : C.mid);
  }
  skyline(g, scroll * 0.12, 17, 28, 44, C.far, "#1a211f", 101, groundY, false);
  skyline(g, scroll * 0.3, 23, 14, 38, C.mid, "#252e2b", 202, groundY, true);
  skyline(g, scroll * 0.55, 31, 6, 20, C.near, "#313c38", 303, groundY, false);
  rect(g, 0, groundY, W, H - groundY, C.street);
  rect(g, 0, groundY, W, 1, C.line);
  const dash = Math.round(scroll) % 16;
  for (let x = -dash; x < W; x += 16) rect(g, x, groundY + 9, 7, 1, C.line);
}

/** Centered message box used for run-over screens. */
export function panel(g: Ctx, title: string, lines: string[], color: string) {
  const height = 24 + lines.length * 8;
  const width = Math.max(120, textWidth(title, 2) + 20, ...lines.map((line) => textWidth(line) + 16));
  const x = Math.round((W - width) / 2);
  const y = Math.round((H - height) / 2) - 6;
  rect(g, x, y, width, height, C.black);
  frame(g, x, y, width, height, color);
  text(g, title, W / 2, y + 7, color, 2, "center");
  lines.forEach((line, index) => text(g, line, W / 2, y + 22 + index * 8, C.grey, 1, "center"));
}

export function bestLine(def: Pick<GameDef, "formatScore" | "lowerIsBetter">, score: number, best: number | null) {
  const beaten = best == null || (def.lowerIsBetter ? score < best : score > best);
  return beaten ? "NEW BEST!" : `BEST ${def.formatScore(best)}`;
}
