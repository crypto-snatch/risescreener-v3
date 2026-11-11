// BOOK STACKER — drop each bid onto the one below. Overhang is cut; a clean
// drop is a full fill. Miss the book entirely and the run is over.
import {
  C, GROUND, H, RIXEL_W, W, bestLine, city, panel, rect, rixel, text,
  type Ctx, type GameDef, type GameEnv, type GameInstance, type Input,
} from "./engine";

const LAYER_H = 7;
const BASE_W = 78;
const FLOOR = 122;
const PERFECT_PX = 2;
const MIN_X = 30;
const MAX_X = W - 6;

interface Layer { x: number; w: number }
interface Scrap { x: number; y: number; w: number; vy: number }

function create(env: GameEnv): GameInstance {
  // Label the ladder with a real price when candles are available.
  const lastClose = env.candleSets[0]?.candles.at(-1)?.c ?? 0;
  const tick = lastClose > 10_000 ? 10 : lastClose > 1_000 ? 1 : lastClose > 100 ? 0.1 : 0.01;
  const basePrice = lastClose > 0 ? Math.floor(lastClose / tick) * tick : 70_000;
  const decimals = tick >= 1 ? 0 : tick >= 0.1 ? 1 : 2;

  const layers: Layer[] = [{ x: Math.round((MIN_X + MAX_X - BASE_W) / 2), w: BASE_W }];
  const scraps: Scrap[] = [];
  let moving = { x: MIN_X, w: BASE_W, dir: 1 };
  let score = 0;
  let perfects = 0;
  let flash = 0;
  let flashPerfect = false;
  let camera = 0;
  let over = false;
  let overClock = 0;
  let clock = 0;

  const speed = () => Math.min(196, 64 + (layers.length - 1) * 5.5);
  const layerY = (index: number) => FLOOR - (index + 1) * LAYER_H + Math.round(camera);

  function drop() {
    if (over) return;
    const below = layers[layers.length - 1];
    const x = Math.round(moving.x);
    const lo = Math.max(x, below.x);
    const hi = Math.min(x + moving.w, below.x + below.w);
    const y = layerY(layers.length) - 3;
    if (hi - lo <= 0) {
      scraps.push({ x, y, w: moving.w, vy: 0 });
      over = true;
      return;
    }
    flash = 0.5;
    if (Math.abs(x - below.x) <= PERFECT_PX) {
      perfects += 1;
      flashPerfect = true;
      score += 2;
      // three clean fills in a row win back some size
      const grow = perfects % 3 === 0 ? Math.min(6, BASE_W - below.w) : 0;
      layers.push({ x: below.x - Math.floor(grow / 2), w: below.w + grow });
    } else {
      perfects = 0;
      flashPerfect = false;
      score += 1;
      layers.push({ x: lo, w: hi - lo });
      if (x < lo) scraps.push({ x, y, w: lo - x, vy: 0 });
      if (x + moving.w > hi) scraps.push({ x: hi, y, w: x + moving.w - hi, vy: 0 });
    }
    const top = layers[layers.length - 1];
    const fromLeft = layers.length % 2 === 0;
    moving = { x: fromLeft ? MIN_X : MAX_X - top.w, w: top.w, dir: fromLeft ? 1 : -1 };
  }

  return {
    update(dt) {
      clock += dt;
      flash = Math.max(0, flash - dt);
      const target = Math.max(0, (layers.length - 8) * LAYER_H);
      camera += (target - camera) * Math.min(1, dt * 6);
      for (const scrap of scraps) { scrap.vy += 420 * dt; scrap.y += scrap.vy * dt; }
      while (scraps.length && scraps[0].y > H + 20) scraps.shift();
      if (over) { overClock += dt; return; }
      moving.x += moving.dir * speed() * dt;
      if (moving.x <= MIN_X) { moving.x = MIN_X; moving.dir = 1; }
      if (moving.x + moving.w >= MAX_X) { moving.x = MAX_X - moving.w; moving.dir = -1; }
    },

    press(input: Input) {
      if (input.kind === "primary" || input.kind === "down") drop();
    },

    draw(g: Ctx) {
      city(g, 0, clock, GROUND + Math.round(camera * 0.6));
      rect(g, 0, 0, 27, H, C.black);
      rect(g, 27, 0, 1, H, C.line);
      // price ladder + stack
      for (let index = 0; index < layers.length; index++) {
        const y = layerY(index);
        if (y > H || y < -LAYER_H) continue;
        const layer = layers[index];
        const top = index === layers.length - 1;
        const lit = top && flash > 0;
        rect(g, layer.x, y, layer.w, LAYER_H - 1, lit ? C.ink : index % 2 ? C.green : C.greenMid);
        rect(g, layer.x, y + LAYER_H - 2, layer.w, 1, lit ? C.green : C.greenDim);
        if (index % 2 === 0) {
          text(g, (basePrice + index * tick).toFixed(decimals), 25, y + 1, top ? C.ink : C.dim, 1, "right");
        }
      }
      rect(g, 28, layerY(-1), W - 28, H, C.street);
      rect(g, 28, layerY(-1), W - 28, 1, C.line);

      if (!over) {
        const y = layerY(layers.length) - 3;
        rect(g, moving.x, y, moving.w, LAYER_H - 1, C.ink);
        rect(g, moving.x, y + LAYER_H - 2, moving.w, 1, C.grey);
        // guide ticks from the layer below
        const below = layers[layers.length - 1];
        rect(g, below.x, y + LAYER_H + 1, 1, 2, C.dim);
        rect(g, below.x + below.w - 1, y + LAYER_H + 1, 1, 2, C.dim);
      }
      for (const scrap of scraps) rect(g, scrap.x, scrap.y, scrap.w, LAYER_H - 1, C.red);

      // Rixel rides the order down — and goes with it when it misses
      if (!over) rixel(g, moving.x + moving.w / 2 - RIXEL_W / 2, layerY(layers.length) - 3, "idle");
      else if (scraps.length) {
        const missed = scraps[scraps.length - 1];
        rixel(g, missed.x + missed.w / 2 - RIXEL_W / 2, missed.y, "jump", true);
      }

      text(g, `DEPTH ${layers.length - 1}`, W - 6, 5, C.green, 2, "right");
      if (flash > 0 && !over) {
        text(g, flashPerfect ? (perfects >= 2 ? `FILLED X${perfects}` : "FILLED") : "PARTIAL FILL", W - 6, 19, flashPerfect ? C.ink : C.grey, 1, "right");
      }
      if (over && overClock > 0.5) {
        panel(g, "ORDER MISSED", [`DEPTH ${layers.length - 1} - ${score} PTS`, bestLine(DEF, score, env.best)], C.red);
      }
    },

    hud: () => `DEPTH ${layers.length - 1} · ${score} PTS`,
    result: () => (over && overClock > 0.5 ? { score, label: DEF.formatScore(score) } : null),
  };
}

const DEF: GameDef = {
  id: "book-stacker",
  title: "BOOK STACKER",
  tagline: "Stack bids into a deep book. Overhang gets cut.",
  controls: "Space / tap to drop the order · line it up exactly for a full fill (2 pts)",
  formatScore: (score) => `${score} PTS`,
  icon: [
    "............",
    "..WWWWWW....",
    "............",
    "....GGGGG...",
    "....DDDDD...",
    "...GGGGGG...",
    "...DDDDDD...",
    "..GGGGGGGG..",
    "..DDDDDDDD..",
    ".GGGGGGGGGG.",
    ".DDDDDDDDDD.",
    "LLLLLLLLLLLL",
  ],
  create,
};

export default DEF;
