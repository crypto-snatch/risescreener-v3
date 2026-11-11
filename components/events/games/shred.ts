// SHRED SPRINT — a reaction test. Hit the button the instant the block lands.
import {
  C, GROUND, H, W, bestLine, city, frame, panel, rect, rixel, text,
  type Ctx, type GameDef, type GameEnv, type GameInstance, type Input,
} from "./engine";

const ROUNDS = 5;
const EARLY_MS = 600;
const MISS_MS = 1500;
const BLOCK_W = 22;
const BLOCK_H = 14;
const SLOT_X = (index: number) => 62 + index * 30;

type Phase = "arm" | "go" | "show" | "over";

function rankOf(avg: number) {
  if (avg < 200) return "SHRED SPEED";
  if (avg < 260) return "BLOCK SPEED";
  if (avg < 340) return "MEMPOOL SPEED";
  return "DIAL-UP SPEED";
}

function create(env: GameEnv): GameInstance {
  const times: number[] = [];
  const notes: string[] = [];
  let phase: Phase = "arm";
  let clock = 0;
  let wait = 1.4 + Math.random() * 2.2;
  let goAt = 0; // performance.now() of the frame that first painted the block
  let total = 0;

  const average = () => (times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0);

  function record(ms: number, note: string) {
    times.push(ms);
    notes.push(note);
    phase = "show";
    clock = 0;
  }

  return {
    update(dt) {
      clock += dt;
      total += dt;
      if (phase === "arm" && clock >= wait) { phase = "go"; clock = 0; goAt = 0; }
      else if (phase === "go" && clock * 1000 >= MISS_MS) record(MISS_MS, "MISS");
      else if (phase === "show" && clock >= 1.1) {
        if (times.length >= ROUNDS) phase = "over";
        else { phase = "arm"; clock = 0; wait = 1.2 + Math.random() * 2.6; }
      }
    },

    press(input: Input) {
      if (phase === "arm") record(EARLY_MS, "EARLY");
      else if (phase === "go") {
        // A press that beats the first painted frame cannot be a reaction to it.
        if (!goAt) return record(EARLY_MS, "EARLY");
        const now = performance.now();
        const at = Math.abs(input.t - now) < 5_000 ? input.t : now;
        record(Math.max(1, Math.round(at - goAt)), "");
      }
    },

    draw(g: Ctx) {
      city(g, 40, total);
      const current = Math.min(times.length, ROUNDS - 1);
      const landed = phase === "go" || phase === "show" ? times.length + (phase === "go" ? 1 : 0) : times.length;

      // the chain: five slots on the street
      for (let index = 0; index < ROUNDS; index++) {
        const x = SLOT_X(index);
        const top = GROUND - BLOCK_H;
        if (index > 0) rect(g, x - 8, top + 6, 8, 2, index < landed ? C.greenDim : C.line);
        if (index < landed) {
          const fresh = phase === "go" && index === times.length;
          rect(g, x, top, BLOCK_W, BLOCK_H, fresh ? C.ink : C.green);
          rect(g, x, top + BLOCK_H - 3, BLOCK_W, 3, fresh ? C.green : C.greenMid);
          rect(g, x + 9, top + 3, 4, 4, C.black);
          const ms = times[index];
          if (ms !== undefined) {
            const bad = notes[index] !== "";
            text(g, bad ? notes[index] : `${ms}`, x + BLOCK_W / 2, top - 8, bad ? C.red : C.ink, 1, "center");
          }
        } else {
          for (let dash = 0; dash < BLOCK_W; dash += 4) {
            rect(g, x + dash, top, 2, 1, C.dim);
            rect(g, x + dash, top + BLOCK_H - 1, 2, 1, C.dim);
          }
          for (let dash = 0; dash < BLOCK_H; dash += 4) {
            rect(g, x, top + dash, 1, 2, C.dim);
            rect(g, x + BLOCK_W - 1, top + dash, 1, 2, C.dim);
          }
        }
      }

      // pending transactions drift toward the open slot while the block builds
      if (phase === "arm") {
        const targetX = SLOT_X(current) + BLOCK_W / 2;
        for (let index = 0; index < 9; index++) {
          const loop = (total * (0.5 + index * 0.07) + index * 0.37) % 1;
          const fromX = index % 2 ? W + 6 : -6;
          const x = fromX + (targetX - fromX) * loop;
          const y = 40 + index * 6 + (GROUND - BLOCK_H - 46 - index * 6) * loop * loop;
          rect(g, x, y, 2, 2, index % 3 === 0 ? C.greenDim : C.dim);
        }
      }

      rixel(g, 22, GROUND - (phase === "go" ? 4 : 0), phase === "go" ? "jump" : "idle", notes[notes.length - 1] === "EARLY" && phase === "show");

      if (phase === "go") {
        if (!goAt) goAt = performance.now();
        frame(g, 0, 0, W, H, C.green);
        frame(g, 1, 1, W - 2, H - 2, C.green);
        text(g, "NOW!", W / 2, 22, C.green, 4, "center");
      } else if (phase === "arm") {
        const dots = ".".repeat(1 + (Math.floor(total * 3) % 3));
        text(g, `BUILDING BLOCK${dots}`, W / 2, 24, C.grey, 1, "center");
        text(g, "WAIT FOR IT", W / 2, 34, C.dim, 2, "center");
      } else if (phase === "show") {
        const ms = times[times.length - 1];
        const note = notes[notes.length - 1];
        text(g, note === "EARLY" ? "FRONT-RUN!" : note ? "MISSED!" : `${ms} MS`, W / 2, 22, note ? C.red : C.ink, 3, "center");
        if (note) text(g, `COUNTS AS ${ms} MS`, W / 2, 42, C.grey, 1, "center");
      }
      text(g, `BLOCK ${Math.min(times.length + (phase === "show" || phase === "over" ? 0 : 1), ROUNDS)}/${ROUNDS}`, 6, 5, C.grey);

      if (phase === "over") {
        const avg = average();
        panel(g, `${avg} MS`, [rankOf(avg), bestLine(DEF, avg, env.best)], C.green);
      }
    },

    hud: () => (times.length ? `BLOCK ${times.length}/${ROUNDS} · AVG ${average()} MS` : `BLOCK 0/${ROUNDS}`),
    result: () => (phase === "over" ? { score: average(), label: DEF.formatScore(average()) } : null),
  };
}

const DEF: GameDef = {
  id: "shred-sprint",
  title: "SHRED SPRINT",
  tagline: "Five blocks. Hit the instant each one lands.",
  controls: "Space / tap the moment NOW! appears · pressing early costs 600 ms · lower is better",
  lowerIsBetter: true,
  formatScore: (score) => `${score} MS`,
  icon: [
    "............",
    ".W..W..W....",
    "..W..W..W...",
    "............",
    "....GGGGGG..",
    "WW..GGGGGG..",
    "....GGKKGG..",
    "WWW.GGKKGG..",
    "....GGGGGG..",
    "WW..DDDDDD..",
    "............",
    "LLLLLLLLLLLL",
  ],
  create,
};

export default DEF;
