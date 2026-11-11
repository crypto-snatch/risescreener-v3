// LONG OR SHORT — read 24 real RISEx 5-minute candles, call the next half hour.
import {
  C, H, W, bestLine, frame, panel, rect, rixel, text, token,
  type Bar, type CandleSet, type Ctx, type GameDef, type GameEnv, type GameInstance, type Input,
} from "./engine";

const VISIBLE = 24;
const HIDDEN = 6;
const STEP = 7;
const BODY = 5;
const CHART_X = 15;
const CHART_Y = 16;
const CHART_H = 78;
const DECIDE_S = 9;
const LIVES = 3;

interface Round { symbol: string; bars: Bar[]; lo: number; hi: number; entry: number; exit: number }

function pickRound(sets: CandleSet[]): Round | null {
  const usable = sets.filter((set) => set.candles.length >= VISIBLE + HIDDEN);
  for (let attempt = 0; attempt < 60 && usable.length; attempt++) {
    const set = usable[Math.floor(Math.random() * usable.length)];
    const start = Math.floor(Math.random() * (set.candles.length - VISIBLE - HIDDEN + 1));
    const bars = set.candles.slice(start, start + VISIBLE + HIDDEN);
    const seen = bars.slice(0, VISIBLE);
    const lo = Math.min(...seen.map((bar) => bar.l));
    const hi = Math.max(...seen.map((bar) => bar.h));
    const entry = seen[VISIBLE - 1].c;
    const exit = bars[bars.length - 1].c;
    if (!(hi > lo) || !(entry > 0)) continue;
    // Skip closed-session stretches and coin-flip finishes.
    if (seen.filter((bar) => bar.h > bar.l).length < 18) continue;
    if (Math.abs(exit - entry) / entry < 0.0004) continue;
    // Scale from what the player can see, with even headroom both ways, so the
    // empty space on the chart never hints at where price goes next.
    const mid = (hi + lo) / 2;
    const half = (hi - lo) * 0.85;
    return { symbol: set.symbol, bars, lo: mid - half, hi: mid + half, entry, exit };
  }
  return null;
}

// Offline fallback so the cabinet still works when RISEx candles are unavailable.
function simulatedSet(): CandleSet {
  const candles: Bar[] = [];
  let price = 100;
  for (let index = 0; index < 160; index++) {
    const open = price;
    const close = open * (1 + (Math.random() - 0.5) * 0.006);
    candles.push({
      o: open,
      c: close,
      h: Math.max(open, close) * (1 + Math.random() * 0.002),
      l: Math.min(open, close) * (1 - Math.random() * 0.002),
    });
    price = close;
  }
  return { symbol: "SIM", candles };
}

type Phase = "pick" | "reveal" | "result" | "over";

function create(env: GameEnv): GameInstance {
  const sets = env.candleSets.length ? env.candleSets : [simulatedSet()];
  const nextRound = () => pickRound(sets) ?? pickRound([simulatedSet()])!;

  let round = nextRound();
  let phase: Phase = "pick";
  let clock = 0;
  let shown = 0;
  let side: "long" | "short" | null = null;
  let won = false;
  let lives = LIVES;
  let score = 0;
  let streak = 0;

  const y = (value: number) => {
    const ratio = (value - round.lo) / (round.hi - round.lo);
    return Math.round(CHART_Y + CHART_H - Math.max(0, Math.min(1, ratio)) * CHART_H);
  };

  function settle(pick: "long" | "short" | null) {
    side = pick;
    won = pick !== null && (round.exit > round.entry) === (pick === "long");
    phase = "reveal";
    clock = 0;
    shown = 0;
  }

  return {
    update(dt) {
      clock += dt;
      if (phase === "pick" && clock >= DECIDE_S) settle(null);
      else if (phase === "reveal") {
        shown = Math.min(HIDDEN, Math.floor(clock / 0.26) + 1);
        if (clock >= HIDDEN * 0.26 + 0.2) {
          phase = "result";
          clock = 0;
          if (won) { score += 1; streak += 1; } else { lives -= 1; streak = 0; }
        }
      } else if (phase === "result" && clock >= 1.5) {
        if (lives <= 0) phase = "over";
        else { round = nextRound(); phase = "pick"; clock = 0; shown = 0; side = null; }
      }
    },

    press(input: Input) {
      if (phase !== "pick") return;
      if (input.kind === "left" || input.kind === "up") settle("long");
      else if (input.kind === "right" || input.kind === "down") settle("short");
      else if (input.x !== undefined) settle(input.x < W / 2 ? "long" : "short");
    },

    draw(g: Ctx) {
      rect(g, 0, 0, W, H, C.bg);
      // header
      text(g, `${round.symbol} 5M`, 8, 5, C.ink);
      text(g, round.symbol === "SIM" ? "PRACTICE TAPE" : "REAL RISEX TAPE", 8 + (round.symbol.length + 4) * 4, 5, C.dim);
      for (let index = 0; index < LIVES; index++) token(g, W - 13 - index * 7, 4, index < lives);

      // chart frame + unseen zone
      const hiddenX = CHART_X + VISIBLE * STEP - 1;
      rect(g, 6, CHART_Y - 2, W - 12, CHART_H + 4, C.far);
      rect(g, hiddenX, CHART_Y - 2, W - 6 - hiddenX, CHART_H + 4, C.mid);
      for (let gy = CHART_Y + 13; gy < CHART_Y + CHART_H; gy += 13) {
        for (let gx = 8; gx < W - 8; gx += 4) rect(g, gx, gy, 1, 1, C.near);
      }
      const entryY = y(round.entry);
      for (let gx = hiddenX; gx < W - 7; gx += 3) rect(g, gx, entryY, 2, 1, C.grey);

      const count = VISIBLE + (phase === "pick" ? 0 : shown);
      for (let index = 0; index < count; index++) {
        const bar = round.bars[index];
        const up = bar.c >= bar.o;
        const color = up ? C.green : C.red;
        const x = CHART_X + index * STEP;
        const top = y(Math.max(bar.o, bar.c));
        const bottom = y(Math.min(bar.o, bar.c));
        rect(g, x + 2, y(bar.h), 1, Math.max(1, y(bar.l) - y(bar.h)), color);
        rect(g, x, top, BODY, Math.max(1, bottom - top), color);
      }
      if (phase === "pick") {
        const blink = Math.floor(clock * 2) % 2 === 0;
        text(g, "?", hiddenX + 26, CHART_Y + 26, blink ? C.grey : C.dim, 4, "center");
        text(g, "NEXT 30M", hiddenX + 26, CHART_Y + 52, C.dim, 1, "center");
        // decision clock
        const left = Math.max(0, 1 - clock / DECIDE_S);
        rect(g, 6, CHART_Y + CHART_H + 4, Math.round((W - 12) * left), 2, left < 0.3 ? C.red : C.greenDim);
      }

      // call buttons
      const buttonY = 104;
      const longOn = phase === "pick" || side === "long";
      const shortOn = phase === "pick" || side === "short";
      rect(g, 6, buttonY, 112, 25, longOn ? C.greenDark : C.far);
      frame(g, 6, buttonY, 112, 25, longOn ? C.green : C.line);
      text(g, "LONG", 62, buttonY + 5, longOn ? C.green : C.dim, 2, "center");
      text(g, "< OR TAP LEFT", 62, buttonY + 18, longOn ? C.greenDim : C.line, 1, "center");
      rect(g, 122, buttonY, 112, 25, shortOn ? C.redDark : C.far);
      frame(g, 122, buttonY, 112, 25, shortOn ? C.red : C.line);
      text(g, "SHORT", 178, buttonY + 5, shortOn ? C.red : C.dim, 2, "center");
      text(g, "TAP RIGHT OR >", 178, buttonY + 18, shortOn ? C.redDim : C.line, 1, "center");

      if (phase === "result") {
        const movePct = ((round.exit - round.entry) / round.entry) * 100;
        const label = side === null ? "TOO SLOW" : won ? "GOOD CALL" : "REKT";
        const color = won ? C.green : C.red;
        const boxW = 96;
        rect(g, 12, CHART_Y + 3, boxW, 23, C.black);
        frame(g, 12, CHART_Y + 3, boxW, 23, color);
        text(g, label, 12 + boxW / 2, CHART_Y + 7, color, 2, "center");
        text(g, `${movePct >= 0 ? "+" : "-"}${Math.abs(movePct).toFixed(2)}% IN 30M`, 12 + boxW / 2, CHART_Y + 19, C.grey, 1, "center");
        rixel(g, 112, CHART_Y + 25 - (won ? Math.abs(Math.round(Math.sin(clock * 14) * 3)) : 0), won ? "jump" : "idle", !won);
      }
      if (phase === "over") {
        panel(g, "OUT OF LIVES", [`${score} GOOD CALLS`, bestLine(DEF, score, env.best)], C.red);
      }
    },

    hud: () => `CALLS ${score} · STREAK ${streak}`,
    result: () => (phase === "over" ? { score, label: DEF.formatScore(score) } : null),
  };
}

const DEF: GameDef = {
  id: "long-or-short",
  title: "LONG OR SHORT",
  tagline: "Real RISEx candles. Call the next 30 minutes.",
  controls: "← / tap left = LONG · → / tap right = SHORT · three wrong calls end the run",
  formatScore: (score) => `${score} CALLS`,
  icon: [
    "..........G.",
    "....G.....G.",
    "....G..R..G.",
    ".G..G..R..G.",
    ".G..G..R.GGG",
    ".G.GGG.R.GGG",
    "GGGGGG.R.GGG",
    "GGGGGGRRRGGG",
    "GGG.G.RRR.G.",
    "GGG...RRR...",
    ".G.....R....",
    ".G..........",
  ],
  create,
};

export default DEF;
