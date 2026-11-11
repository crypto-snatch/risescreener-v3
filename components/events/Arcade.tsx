"use client";

import { useEffect, useRef, useState } from "react";
import { GAMES, ICON_PALETTE } from "./games";
import {
  C, GROUND, H, W, city, rect, rixel, text, textWidth,
  type CandleSet, type Ctx, type GameDef, type GameInstance, type Input,
} from "./games/engine";

const STORE_KEY = "rs-arcade-best-v1";
const RETRY_LOCK_MS = 700;

type Best = Record<string, number>;

function readBest(): Best {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Best) : {};
  } catch {
    return {};
  }
}

function PixelIcon({ rows, size = 36 }: { rows: string[]; size?: number }) {
  const cells: { x: number; y: number; color: string }[] = [];
  rows.forEach((row, y) => [...row].forEach((char, x) => {
    const color = ICON_PALETTE[char];
    if (color) cells.push({ x, y, color });
  }));
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
      {cells.map((cell) => <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={1} height={1} fill={cell.color} />)}
    </svg>
  );
}

function drawTitle(g: Ctx, game: GameDef, clock: number, best: number | undefined) {
  city(g, clock * 9, clock);
  const bob = Math.floor(clock * 2) % 2;
  rixel(g, W / 2 - 27, 62 - bob, "idle", false, 3);
  const scale = textWidth(game.title, 3) <= W - 16 ? 3 : 2;
  text(g, game.title, W / 2, 69, C.green, scale, "center");
  text(g, game.tagline, W / 2, 90, C.grey, 1, "center");
  if (Math.floor(clock * 2.4) % 2 === 0) text(g, "CLICK OR TAP TO START", W / 2, GROUND + 4, C.ink, 1, "center");
  if (best !== undefined) text(g, `BEST ${game.formatScore(best)}`, W / 2, GROUND + 14, C.greenDim, 1, "center");
}

function drawRetry(g: Ctx, clock: number) {
  rect(g, 0, H - 13, W, 13, C.black);
  if (Math.floor(clock * 2.4) % 2 === 0) text(g, "TAP OR SPACE TO PLAY AGAIN", W / 2, H - 9, C.ink, 1, "center");
}

const KEYS: Record<string, Input["kind"]> = {
  " ": "primary", Enter: "primary",
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};

export default function Arcade({ candleSets }: { candleSets: CandleSet[] }) {
  const [gameId, setGameId] = useState(GAMES[0].id);
  const [best, setBest] = useState<Best>({});
  const [hud, setHud] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bestRef = useRef<Best>({});
  // The page re-fetches on a timer; a run keeps the candles it started with.
  const dataRef = useRef(candleSets);
  // Keyboard input only belongs to the arcade after the player touches it.
  const activeRef = useRef(false);

  useEffect(() => {
    if (candleSets.length) dataRef.current = candleSets;
  }, [candleSets]);

  useEffect(() => {
    const stored = readBest();
    bestRef.current = stored;
    setBest(stored);
  }, []);

  const game = GAMES.find((entry) => entry.id === gameId) ?? GAMES[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !root || !g) return;

    // Paint at a whole-number multiple of the logical screen, one step above the
    // displayed size. Every logical pixel stays the same width; scaling 240px
    // straight to an arbitrary CSS width would make columns uneven.
    const fit = () => {
      const devicePx = canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1);
      const factor = Math.max(1, Math.min(8, Math.ceil(devicePx / W)));
      if (canvas.width !== W * factor) {
        canvas.width = W * factor;
        canvas.height = H * factor;
      }
      g.setTransform(factor, 0, 0, factor, 0, 0);
      g.imageSmoothingEnabled = false;
    };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(canvas);

    let mode: "title" | "play" | "over" = "title";
    let instance: GameInstance | null = null;
    let overAt = 0;
    let onScreen = true;
    let clock = 0;
    let last = performance.now();
    let lastHud = "";
    let raf = 0;

    const start = () => {
      instance = game.create({ candleSets: dataRef.current, best: bestRef.current[game.id] ?? null });
      mode = "play";
    };
    const press = (input: Input) => {
      if (mode === "title") start();
      else if (mode === "over") { if (performance.now() - overAt > RETRY_LOCK_MS) start(); }
      else instance?.press(input);
    };
    const release = (input: Input) => { if (mode === "play") instance?.release?.(input); };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!onScreen || document.hidden) return;
      clock += dt;
      if (mode === "title" || !instance) {
        drawTitle(g, game, clock, bestRef.current[game.id]);
      } else {
        if (mode === "play") instance.update(dt);
        instance.draw(g);
        const result = instance.result();
        if (mode === "play" && result) {
          mode = "over";
          overAt = now;
          const previous = bestRef.current[game.id];
          const better = previous === undefined || (game.lowerIsBetter ? result.score < previous : result.score > previous);
          if (better) {
            const next = { ...bestRef.current, [game.id]: result.score };
            bestRef.current = next;
            setBest(next);
            try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* private mode: best lasts for this visit */ }
          }
        }
        if (mode === "over" && now - overAt > RETRY_LOCK_MS) drawRetry(g, clock);
      }
      const line = mode === "title" || !instance ? "" : instance.hud();
      if (line !== lastHud) { lastHud = line; setHud(line); }
    };
    raf = requestAnimationFrame(tick);

    const toLogical = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      return { x: ((event.clientX - box.left) / box.width) * W, y: ((event.clientY - box.top) / box.height) * H };
    };
    const onPointerDown = (event: PointerEvent) => {
      activeRef.current = true;
      press({ kind: "primary", ...toLogical(event), t: event.timeStamp });
    };
    const onPointerUp = (event: PointerEvent) => release({ kind: "primary", t: event.timeStamp });
    const onDocPointerDown = (event: PointerEvent) => {
      activeRef.current = root.contains(event.target as Node);
    };
    const typing = (target: EventTarget | null) =>
      target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    const onKeyDown = (event: KeyboardEvent) => {
      const kind = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!kind || !activeRef.current || !onScreen || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      event.preventDefault(); // keep Space and the arrows from scrolling the page mid-run
      if (!event.repeat) press({ kind, t: event.timeStamp });
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const kind = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (kind && activeRef.current) release({ kind, t: event.timeStamp });
    };
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }, { threshold: 0.25 });
    observer.observe(canvas);

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointerdown", onDocPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      resize.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [game]);

  const bestOf = (entry: GameDef) => (best[entry.id] === undefined ? "No score yet" : `Best ${entry.formatScore(best[entry.id])}`);

  return (
    <div className="arcade" ref={rootRef}>
      <div className="arcade-screen">
        <div className="arcade-hud">
          <span className="arcade-hud-title">{game.title}</span>
          <span className="arcade-hud-score tnum">{hud || bestOf(game)}</span>
        </div>
        <canvas
          ref={canvasRef}
          className="arcade-canvas"
          width={W}
          height={H}
          role="img"
          aria-label={`${game.title} — ${game.tagline}`}
        />
        <p className="arcade-controls">{game.controls}</p>
      </div>
      <div className="arcade-list" role="tablist" aria-label="Choose a game">
        {GAMES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === game.id}
            className="arcade-pick"
            data-active={entry.id === game.id}
            onClick={() => { setHud(""); setGameId(entry.id); }}
          >
            <span className="arcade-pick-icon"><PixelIcon rows={entry.icon} /></span>
            <span className="arcade-pick-text">
              <b>{entry.title}</b>
              <span>{entry.tagline}</span>
              <i className="tnum">{bestOf(entry)}</i>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
