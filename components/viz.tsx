"use client";

import { useEffect, useRef, useState } from "react";
import { usd, price } from "@/lib/format";

/* ============================================================
   viz.tsx — RiseScreener V4 visualization kit
   Self-contained SVG/CSS charts on the V4 matte design system.
   ============================================================ */

const LONG = "#35c98d";
const SHORT = "#e46a7b";

// serializable format presets (server→client safe)
export type Fmt = "usd" | "int" | "pct" | "raw";
function fmt(n: number, f: Fmt): string {
  if (f === "usd") return usd(n);
  if (f === "pct") return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  if (f === "int") return Math.round(n).toLocaleString();
  return String(Math.round(n));
}

// ── animated number counter (counts up on mount / when value changes) ──
export function CountUp({
  value,
  format = "raw",
  duration = 950,
  className,
  style,
}: {
  value: number;
  format?: Fmt;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>();
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(a + (b - a) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);
  return <span className={className} style={style}>{fmt(display, format)}</span>;
}

// ── hero KPI tile with animated value ──
export function Kpi({ label, value, format = "usd", accent, hint }: { label: string; value: number; format?: Fmt; accent?: boolean; hint?: string }) {
  return (
    <div className="glass glow-edge stat-card" style={{ padding: "15px 17px", borderRadius: "var(--r-lg)" }}>
      <div style={{ fontSize: 10.5, letterSpacing: ".13em", textTransform: "uppercase", color: "var(--muted-2)", fontWeight: 500 }}>{label}</div>
      <CountUp value={value} format={format} className={"tnum" + (accent ? " grad-text" : "")} style={{ display: "block", fontSize: 30, fontWeight: 700, marginTop: 9, letterSpacing: "-.01em", color: accent ? undefined : "var(--ink)", lineHeight: 1.02, fontFamily: "var(--font-mono)" }} />
      {hint && <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

// ── live trade tape (marquee ticker) ──
export type TapeItem = { symbol: string; side: "BUY" | "SELL"; price: number; notional: number };
export function LiveTape({ items }: { items: TapeItem[] }) {
  if (!items.length) return null;
  const row = [...items, ...items]; // duplicate for seamless loop
  return (
    <div className="marquee-mask" style={{ overflow: "hidden", width: "100%" }}>
      <div className="marquee-track">
        {row.map((t, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12 }}>
            <span style={{ fontWeight: 700 }}>{t.symbol}</span>
            <span className="tnum" style={{ color: "var(--muted)" }}>${price(t.price)}</span>
            <span style={{ color: t.side === "BUY" ? LONG : SHORT, fontWeight: 600 }}>{t.side === "BUY" ? "▲" : "▼"} {usd(t.notional)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── OI leaders — aligned tiles with an explicit relative-size bar ──
type Box = { name: string; value: number; color: string; sub?: string };
export function Treemap({ items, height = 320 }: { items: Box[]; height?: number }) {
  const total = items.reduce((s, b) => s + b.value, 0) || 1;
  const max = Math.max(...items.map((item) => item.value), 1);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="oi-leader-grid" style={{ width: "100%", height }}>
      {items.map((item, index) => {
        const on = hover === item.name;
        return (
          <div
            key={item.name}
            tabIndex={0}
            aria-label={`${item.name} open interest ${usd(item.value)}, ${((item.value / total) * 100).toFixed(1)} percent of shown markets`}
            onMouseEnter={() => setHover(item.name)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(item.name)}
            onBlur={() => setHover(null)}
            style={{
              background: `color-mix(in oklab, ${item.color} ${on ? 22 : 12}%, transparent)`,
              border: `1px solid color-mix(in oklab, ${item.color} ${on ? 65 : 34}%, transparent)`,
              borderRadius: 7,
              overflow: "hidden",
              padding: "10px 11px",
              display: "grid",
              gridTemplateRows: "auto 1fr auto",
              gap: 8,
              transition: "background .16s ease, border-color .16s ease, box-shadow .16s ease",
              boxShadow: on ? `inset 0 0 0 1px color-mix(in oklab, ${item.color} 34%, transparent)` : "none",
              outline: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <b style={{ fontSize: 13, color: "var(--ink)" }}>{item.name}</b>
              <span className="tnum" style={{ color: "var(--muted)", fontSize: 10 }}>#{index + 1}</span>
            </div>
            <div className="tnum" style={{ alignSelf: "end", fontSize: 13, color: item.color, fontWeight: 700 }}>
              {usd(item.value)}
              <small style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 10.5, fontWeight: 500 }}>
                {((item.value / total) * 100).toFixed(1)}% of top OI{item.sub ? ` · ${item.sub}` : ""}
              </small>
            </div>
            <div style={{ height: 5, background: "var(--hair)", borderRadius: 4, overflow: "hidden" }}>
              <span style={{ display: "block", width: `${Math.max(3, (item.value / max) * 100)}%`, height: "100%", background: item.color, borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── market heatmap — ranked, equally readable market tiles ──
export function MarketHeatmap({ items, height = 260 }: { items: { symbol: string; volume: number; change: number }[]; height?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => setWidth(node.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const clean = items
    .filter((item) => Number.isFinite(item.volume) && item.volume > 0 && Number.isFinite(item.change))
    .sort((a, b) => b.volume - a.volume);
  if (!clean.length) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-2)", fontSize: 13 }}>no data</div>;

  const total = clean.reduce((sum, item) => sum + item.volume, 0) || 1;
  const maxVolume = clean[0]?.volume || 1;
  const sortedMagnitudes = clean.map((item) => Math.abs(item.change)).sort((a, b) => a - b);
  const colourScale = Math.max(0.75, sortedMagnitudes[Math.max(0, Math.ceil(sortedMagnitudes.length * 0.9) - 1)] ?? 1);
  const mobile = width < 760;
  const columnCount = mobile ? 1 : width < 1120 ? 2 : 3;
  const rowsPerColumn = Math.ceil(clean.length / columnCount);

  const tile = (item: (typeof clean)[number], index: number) => {
    const col = item.change > 0 ? LONG : item.change < 0 ? SHORT : "#9aa7b4";
    const magnitude = Math.min(1, Math.abs(item.change) / colourScale);
    const on = hover === item.symbol;
    const share = (item.volume / total) * 100;
    const rowIndex = index % rowsPerColumn;
    const columnIndex = Math.floor(index / rowsPerColumn);
    return (
      <div
        key={item.symbol}
        role="listitem"
        tabIndex={0}
        title={`${item.symbol} · ${item.change >= 0 ? "+" : ""}${item.change.toFixed(2)}% · ${usd(item.volume)} 24h volume · ${share.toFixed(1)}% share`}
        aria-label={`Rank ${index + 1}, ${item.symbol}, 24 hour change ${item.change >= 0 ? "plus " : ""}${item.change.toFixed(2)} percent, 24 hour volume ${usd(item.volume)}, ${share.toFixed(1)} percent of shown volume`}
        onMouseEnter={() => setHover(item.symbol)}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover(item.symbol)}
        onBlur={() => setHover(null)}
        onClick={() => setHover(on ? null : item.symbol)}
        style={{
          minWidth: 0,
          minHeight: 0,
          padding: mobile ? "0 8px" : "0 10px",
          borderBottom: rowIndex < rowsPerColumn - 1 ? "1px solid var(--hair-soft)" : "1px solid transparent",
          borderRight: !mobile && columnIndex < columnCount - 1 ? "1px solid var(--hair-soft)" : "none",
          background: on ? `color-mix(in oklab, ${col} 9%, transparent)` : "transparent",
          boxShadow: on ? `inset 3px 0 0 ${col}` : "none",
          display: "grid",
          gridTemplateColumns: mobile
            ? "28px 48px minmax(52px, 1fr) 64px 58px"
            : "25px 45px minmax(48px, 1fr) 62px 56px",
          alignItems: "center",
          gap: 7,
          overflow: "hidden",
          outline: "none",
          cursor: "default",
          transition: "background .16s ease, box-shadow .16s ease",
          position: "relative",
          zIndex: on ? 1 : 0,
        }}
      >
        <span className="tnum" style={{ color: "var(--muted-2)", fontSize: 9.5, fontWeight: 700 }}>#{index + 1}</span>
        <b style={{ minWidth: 0, color: "var(--ink)", fontSize: 11.5, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.symbol}</b>
        <span aria-hidden="true" style={{ height: 4, overflow: "hidden", borderRadius: 3, background: "var(--hair)" }}>
          <span style={{ display: "block", width: `${Math.max(2, (item.volume / maxVolume) * 100)}%`, height: "100%", borderRadius: 3, background: col, opacity: 0.9 }} />
        </span>
        <span className="tnum" style={{ minWidth: 0, color: "var(--muted)", fontSize: 10.5, fontWeight: 700, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{usd(item.volume)}</span>
        <span className="tnum" style={{ color: col, fontSize: 10.5, fontWeight: 800, textAlign: "right", whiteSpace: "nowrap" }}>
          {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
        </span>
      </div>
    );
  };

  return (
    <div
      ref={host}
      role="list"
      aria-label="Markets ranked by 24 hour quote volume"
      style={{
        width: "100%",
        height,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        gridTemplateRows: mobile ? `repeat(${rowsPerColumn}, 38px)` : `repeat(${rowsPerColumn}, minmax(0, 1fr))`,
        gridAutoFlow: "column",
        columnGap: mobile ? 0 : 12,
        overflowX: "hidden",
        overflowY: mobile ? "auto" : "hidden",
        paddingRight: mobile ? 3 : 0,
        overscrollBehavior: "contain",
      }}
    >
      {clean.map(tile)}
    </div>
  );
}

// ── funding heatmap — grid of market cells coloured by funding APR ──
export function FundingHeatmap({ cells }: { cells: { symbol: string; apr: number }[] }) {
  const max = Math.max(1, ...cells.map((c) => Math.abs(c.apr)));
  return (
    <div style={{ display: "grid", height: "100%", gridTemplateColumns: "repeat(auto-fit, minmax(74px, 1fr))", gridAutoRows: "52px", alignContent: "center", gap: 6, overflowY: "auto" }}>
      {cells.map((c) => {
        const mag = Math.min(1, Math.abs(c.apr) / max);
        const col = c.apr >= 0 ? LONG : SHORT;
        return (
          <div key={c.symbol} title={`${c.symbol} funding APR`} style={{
            minWidth: 0, minHeight: 0, borderRadius: 8, padding: "8px", textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: `color-mix(in oklab, ${col} ${(8 + mag * 42).toFixed(0)}%, transparent)`,
            border: `1px solid color-mix(in oklab, ${col} ${(20 + mag * 40).toFixed(0)}%, transparent)`,
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)" }}>{c.symbol}</div>
            <div className="tnum" style={{ fontSize: 11, fontWeight: 700, color: col, marginTop: 3 }}>{c.apr >= 0 ? "+" : ""}{c.apr.toFixed(1)}%</div>
          </div>
        );
      })}
    </div>
  );
}

// ── market bubble scatter — x: 24h change%, y: volume(log), size: OI ──
export function MarketBubbles({ points, height = 240 }: { points: { symbol: string; change: number; volume: number; oi: number }[]; height?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const pad = { l: 30, r: 20, t: 18, b: 24 };
  const W = 760, H = height;
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const changes = points.map((p) => p.change);
  // pad the x-domain slightly beyond the data so bubbles use the full width
  const lo = Math.min(-1, ...changes), hi = Math.max(1, ...changes);
  const span = Math.max(2, hi - lo);
  const xLo = lo - span * 0.08, xHi = hi + span * 0.08;
  const vols = points.map((p) => Math.log10(Math.max(1, p.volume)));
  const vMin = Math.min(...vols), vMax = Math.max(...vols, vMin + 1);
  const maxOi = Math.max(1, ...points.map((p) => p.oi));
  const xOf = (c: number) => pad.l + ((c - xLo) / (xHi - xLo)) * iw;
  const yOf = (v: number) => pad.t + (1 - (v - vMin) / (vMax - vMin)) * ih;
  const rOf = (oi: number) => 7 + Math.sqrt(oi / maxOi) * 22; // gentler size range
  const ticks = [xLo, (xLo + xHi) / 2, 0, xHi].filter((t, i, a) => a.indexOf(t) === i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: "visible", fontFamily: "var(--font)" }}>
      {/* faint vertical gridlines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad.l + f * iw} y1={pad.t} x2={pad.l + f * iw} y2={H - pad.b} stroke="var(--hair-soft)" />
      ))}
      {/* zero line */}
      {xLo < 0 && xHi > 0 && (
        <>
          <line x1={xOf(0)} y1={pad.t} x2={xOf(0)} y2={H - pad.b} stroke="var(--hair)" strokeDasharray="3 5" />
          <text x={xOf(0)} y={H - pad.b + 16} fontSize="11" fill="var(--muted)" textAnchor="middle">0%</text>
        </>
      )}
      <text x={pad.l} y={H - pad.b + 16} fontSize="11" fill="var(--short)" textAnchor="start">{xLo.toFixed(1)}%</text>
      <text x={W - pad.r} y={H - pad.b + 16} fontSize="11" fill="var(--long)" textAnchor="end">+{xHi.toFixed(1)}%</text>
      <text x={pad.l} y={pad.t - 6} fontSize="11" fill="var(--muted)" textAnchor="start">← volume →</text>
      {/* draw big bubbles first so small ones sit on top for labels */}
      {[...points].sort((a, b) => b.oi - a.oi).map((p) => {
        const col = p.change >= 0 ? LONG : SHORT;
        const on = hover === p.symbol;
        const cx = xOf(p.change), cy = yOf(Math.log10(Math.max(1, p.volume))), r = rOf(p.oi);
        const inside = r >= 15;
        return (
          <g key={p.symbol} onMouseEnter={() => setHover(p.symbol)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
            <circle cx={cx} cy={cy} r={r} fill={`color-mix(in oklab, ${col} ${on ? 42 : 20}%, transparent)`} stroke={col} strokeWidth={on ? 1.8 : 1.1} />
            {inside ? (
              <text x={cx} y={cy + 3.5} fontSize={11} fontWeight={800} fill="var(--ink)" textAnchor="middle" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,.35)" strokeWidth={2.4}>{p.symbol}</text>
            ) : (
              <text x={cx} y={cy - r - 3} fontSize={10} fontWeight={700} fill={col} textAnchor="middle">{p.symbol}</text>
            )}
            {on && (
              <text x={cx} y={inside ? cy - r - 4 : cy - r - 14} fontSize="11" fill="var(--muted)" fontWeight={600} textAnchor="middle">{p.change >= 0 ? "+" : ""}{p.change.toFixed(1)}% · {usd(p.oi)} OI</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── liquidation heatmap — notional at risk by price level (intuitive) ──
// Each row is a price band; bar length = notional whose liquidation price sits
// there, split long (green, liquidate as price falls) vs short (red, as it rises).
export function LiqLevels({
  bins,
  currentPrice,
  fmtPrice = (p) => p.toLocaleString("en-US", { maximumFractionDigits: 0 }),
}: {
  bins: { priceLow: number; priceHigh: number; longUsd: number; shortUsd: number; count: number }[];
  currentPrice?: number;
  fmtPrice?: (p: number) => string;
}) {
  const rows = bins
    .map((b) => ({ ...b, mid: (b.priceLow + b.priceHigh) / 2, total: b.longUsd + b.shortUsd }))
    .filter((b) => b.total > 0)
    .sort((a, b) => b.mid - a.mid);
  if (!rows.length) return <div style={{ padding: "28px 0", textAlign: "center", color: "var(--muted-2)", fontSize: 13 }}>No indexed positions at risk.</div>;
  const max = Math.max(...rows.map((r) => r.total));
  // index of the first row whose band is below the current price (marker goes above it)
  const markerIdx = currentPrice != null ? rows.findIndex((r) => r.priceHigh <= currentPrice) : -1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingRight: 5 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginBottom: 12, fontSize: 12, position: "sticky", top: 0, zIndex: 1, paddingBottom: 7, background: "var(--bg-2)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: LONG }} /> Long liquidations (price ↓)</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: SHORT }} /> Short liquidations (price ↑)</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((r, i) => {
          const longW = r.total > 0 ? (r.longUsd / r.total) * 100 : 0;
          const barW = Math.max(2, (r.total / max) * 100);
          return (
            <div key={`${r.priceLow}-${i}`}>
              {i === markerIdx && currentPrice != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "3px 0" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-ink)", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>${fmtPrice(currentPrice)}</span>
                  <span style={{ flex: 1, height: 1, background: "var(--accent-line)" }} />
                  <span style={{ fontSize: 10, color: "var(--accent-ink)", letterSpacing: ".08em" }}>MARK</span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(56px,72px) minmax(0,1fr) minmax(58px,74px)", gap: 8, alignItems: "center" }}>
                <span className="tnum" style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{fmtPrice(r.mid)}</span>
                <span style={{ display: "flex", height: 16, borderRadius: 4, overflow: "hidden", background: "var(--hair-soft)", width: `${barW}%` }} title={`${r.count} positions`}>
                  <span style={{ width: `${longW}%`, background: LONG, opacity: 0.85 }} />
                  <span style={{ width: `${100 - longW}%`, background: SHORT, opacity: 0.85 }} />
                </span>
                <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{usd(r.total)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── long/short pressure bar (or any two-sided split) ──
export function PressureBar({ left, right, leftLabel, rightLabel }: { left: number; right: number; leftLabel?: string; rightLabel?: string }) {
  const total = left + right || 1;
  const lp = (left / total) * 100;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
        <span style={{ color: LONG, fontWeight: 700 }}>{leftLabel ?? "Long"} {lp.toFixed(0)}%</span>
        <span style={{ color: SHORT, fontWeight: 700 }}>{(100 - lp).toFixed(0)}% {rightLabel ?? "Short"}</span>
      </div>
      <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", background: "var(--hair)" }}>
        <div style={{ width: `${lp}%`, background: LONG, opacity: 0.82, transition: "width .5s ease" }} />
        <div style={{ width: `${100 - lp}%`, background: SHORT, opacity: 0.82, transition: "width .5s ease" }} />
      </div>
    </div>
  );
}

// ── mini sparkline (SVG path) for movers grid ──
export function Spark({ data, color, width = 88, height = 30 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / rng) * height}`).join(" ");
  const id = `sp-${Math.round(min * 1e4)}-${data.length}-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${id})`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
