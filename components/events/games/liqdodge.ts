// LIQ DODGE — run the tape while leverage climbs. Red candles liquidate on touch.
import {
  C, GROUND, RIXEL_H, W, bestLine, city, panel, rect, rixel, text, token,
  type Ctx, type GameDef, type GameEnv, type GameInstance, type Input,
} from "./engine";

const RUNNER_X = 40;
const TIERS = [1, 2, 3, 5, 10, 20, 50];
const TIER_DISTANCE = 620;
const JUMP_V = 182;
const GRAVITY = 640;
const HOLD_GRAVITY = 370;
const CEILING_GAP = 24; // clearance under a hanging candle: walk under, never jump into

interface Obstacle { x: number; w: number; h: number; hanging: boolean }
interface Pickup { x: number; y: number; taken: boolean }

function create(env: GameEnv): GameInstance {
  let distance = 0;
  let height = 0; // feet above the ground
  let velocity = 0;
  let held = false;
  let score = 0;
  let tier = 0;
  let tierFlash = 0;
  let dead = false;
  let deadClock = 0;
  let clock = 0;
  let nextSpawn = 150;
  const obstacles: Obstacle[] = [];
  const pickups: Pickup[] = [];

  const speed = () => 80 + tier * 13;
  const leverage = () => TIERS[tier];

  function spawn() {
    const roll = Math.random();
    const x = W + 12;
    let recovery = 0.82;
    if (tier >= 1 && roll < 0.24) {
      obstacles.push({ x, w: 7, h: GROUND - CEILING_GAP, hanging: true });
      if (Math.random() < 0.5) pickups.push({ x: x + 1, y: GROUND - 9, taken: false });
    } else {
      const tall = tier >= 2 && roll > 0.8;
      const h = tall ? 27 + Math.floor(Math.random() * 2) * 4 : 11 + Math.floor(Math.random() * 3) * 4;
      if (tall) recovery = 1.15; // a held jump stays airborne longer
      obstacles.push({ x, w: 7, h, hanging: false });
      if (Math.random() < 0.55) pickups.push({ x: x + 1, y: GROUND - h - 14, taken: false });
    }
    // Leave at least a full jump of room, measured in time so it stays fair as speed rises.
    nextSpawn = speed() * (recovery + Math.random() * 0.85);
  }

  function jump() {
    if (dead || height > 0) return;
    velocity = JUMP_V;
    height = 0.01;
    held = true;
  }

  return {
    update(dt) {
      clock += dt;
      if (dead) {
        deadClock += dt;
        velocity -= GRAVITY * dt;
        height = Math.max(0, height + velocity * dt);
        return;
      }
      const step = speed() * dt;
      distance += step;
      score += step * leverage() * 0.1;
      tierFlash = Math.max(0, tierFlash - dt);
      const reached = Math.min(TIERS.length - 1, Math.floor(distance / TIER_DISTANCE));
      if (reached > tier) { tier = reached; tierFlash = 1.4; }

      if (height > 0) {
        velocity -= (held && velocity > 0 ? HOLD_GRAVITY : GRAVITY) * dt;
        height += velocity * dt;
        if (height <= 0) { height = 0; velocity = 0; }
      }

      nextSpawn -= step;
      if (nextSpawn <= 0) spawn();

      const left = RUNNER_X + 4;
      const right = RUNNER_X + 14;
      const feet = GROUND - height;
      const head = feet - RIXEL_H + 1;
      for (const obstacle of obstacles) {
        obstacle.x -= step;
        if (obstacle.x + obstacle.w <= left || obstacle.x >= right) continue;
        const hit = obstacle.hanging ? head < obstacle.h : feet > GROUND - obstacle.h + 1;
        if (hit) { dead = true; velocity = 90; held = false; }
      }
      for (const pickup of pickups) {
        pickup.x -= step;
        if (!pickup.taken && pickup.x < right && pickup.x + 5 > left && pickup.y < feet && pickup.y + 5 > head) {
          pickup.taken = true;
          score += 25 * leverage();
        }
      }
      while (obstacles.length && obstacles[0].x < -12) obstacles.shift();
      while (pickups.length && pickups[0].x < -12) pickups.shift();
    },

    press(input: Input) {
      if (input.kind === "primary" || input.kind === "up") jump();
    },
    release() {
      held = false;
    },

    draw(g: Ctx) {
      city(g, distance, clock);
      for (const obstacle of obstacles) {
        const x = Math.round(obstacle.x);
        if (obstacle.hanging) {
          rect(g, x + 3, 0, 1, obstacle.h - 16, C.redDim);
          rect(g, x, obstacle.h - 16, obstacle.w, 16, C.red);
          rect(g, x, obstacle.h - 3, obstacle.w, 3, C.redDim);
        } else {
          const top = GROUND - obstacle.h;
          rect(g, x + 3, top, 1, 5, C.redDim);
          rect(g, x, top + 5, obstacle.w, obstacle.h - 5, C.red);
          rect(g, x, top + 5, obstacle.w, 2, "#f29aa6");
        }
      }
      for (const pickup of pickups) if (!pickup.taken) token(g, pickup.x, pickup.y + (Math.floor(clock * 4 + pickup.x * 0.05) % 2));

      const pose = height > 0 ? "jump" : Math.floor(distance / 7) % 2 ? "runA" : "runB";
      // speed streaks: the thin slash of the mark, trailing behind
      if (!dead) {
        for (let index = 0; index < 2 + Math.min(4, tier); index++) {
          const y = GROUND - height - 3 - index * 3;
          rect(g, RUNNER_X - 5 - index * 3 - (Math.floor(clock * 20 + index) % 3), y, 3 + (index % 2), 1, C.greenDark);
        }
      }
      rixel(g, RUNNER_X, GROUND - height, dead ? "jump" : pose, dead);

      text(g, `LEV ${leverage()}X`, 6, 5, tier >= 4 ? C.gold : C.green, 2);
      text(g, `${Math.floor(score)}`, W - 6, 5, C.ink, 2, "right");
      if (tierFlash > 0 && Math.floor(tierFlash * 8) % 2 === 0) {
        text(g, `LEVERAGE UP ${leverage()}X`, W / 2, 30, C.gold, 2, "center");
      }
      if (dead && deadClock > 0.45) {
        panel(g, "LIQUIDATED", [`${Math.floor(score)} PTS AT ${leverage()}X`, bestLine(DEF, Math.floor(score), env.best)], C.red);
      }
    },

    hud: () => `LEV ${leverage()}X · ${Math.floor(score)} PTS`,
    result: () => (dead && deadClock > 0.45 ? { score: Math.floor(score), label: DEF.formatScore(Math.floor(score)) } : null),
  };
}

const DEF: GameDef = {
  id: "liq-dodge",
  title: "LIQ DODGE",
  tagline: "Leverage climbs as you run. Do not touch red.",
  controls: "Space / tap to jump · hold for a higher jump · stay grounded under hanging candles",
  formatScore: (score) => `${score.toLocaleString("en-US")} PTS`,
  icon: [
    "............",
    ".........R..",
    ".GGGGGG..R..",
    ".GKGGKG..R..",
    ".GGKKGG.RRR.",
    ".GGKKGG.RRR.",
    ".GKGGKG.RRR.",
    ".GGGGGG.RRR.",
    "..W..W..RRR.",
    ".W....W.RRR.",
    "............",
    "LLLLLLLLLLLL",
  ],
  create,
};

export default DEF;
