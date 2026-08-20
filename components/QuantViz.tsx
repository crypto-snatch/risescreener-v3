"use client";

import { useEffect, useState } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";

/**
 * RiseScreener V4 — quantitative visualisation primitives.
 *
 * The components in this file are deliberately dependency-light. Every plot is
 * native SVG or semantic HTML, so the visual language stays flat, matte and
 * legible in both the dark and light themes.
 */

export const QUANT_VIZ_PALETTE = {
  accent: "#2EE88E",
  long: "#35c98d",
  short: "#e46a7b",
  warning: "#d6ae5d",
  price: "#c5d0db",
  slate: "#71879b",
  slateLight: "#94a5b6",
  grid: "rgba(143, 158, 173, 0.12)",
  axis: "rgba(143, 158, 173, 0.28)",
  ink: "var(--ink, #e9edf1)",
  muted: "var(--muted, #868f9c)",
  // Chart annotations are intentionally brighter than secondary page copy.
  // Tiny SVG labels need the higher-contrast theme token in both themes.
  muted2: "var(--muted, #8f99a5)",
} as const;

const P = QUANT_VIZ_PALETTE;
// Explicit stacks (no CSS var()) — SVG presentation attributes don't resolve
// var(), which made chart text fall back to a serif default in some browsers.
const FONT = "Inter, ui-sans-serif, system-ui, 'Segoe UI', sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const VIEW_WIDTH = 760;

export type QuantTime = number | string;

export interface QuantVizBaseProps {
  height?: number;
  className?: string;
  emptyLabel?: string;
}

type TipRow = {
  label: string;
  value: string;
  color?: string;
};

type PlotTip = {
  x: number;
  y: number;
  title: string;
  rows: TipRow[];
};

const shellStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  minWidth: 0,
  overflow: "hidden",
  border: "1px solid var(--hair, rgba(255,255,255,.07))",
  borderRadius: 10,
  background: "var(--card, rgba(255,255,255,.022))",
  color: P.ink,
};

function ChartSurface({
  height,
  viewWidth,
  viewHeight,
  label,
  className,
  tip,
  children,
  minWidth,
  surfaceRef,
}: {
  height: number;
  viewWidth: number;
  viewHeight: number;
  label: string;
  className?: string;
  tip?: PlotTip | null;
  children: ReactNode;
  minWidth?: number;
  surfaceRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={className}
      role="img"
      aria-label={label}
      style={{ ...shellStyle, height, overflowX: minWidth ? "auto" : "hidden" }}
    >
      <div
        style={{
          position: "relative",
          height: "100%",
          minWidth: minWidth ?? 0,
        }}
      >
        {children}
        {tip ? (
          <PlotTooltip
            tip={tip}
            viewWidth={viewWidth}
            viewHeight={viewHeight}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Match an SVG's user-space width to its rendered CSS width. This keeps text,
 * circles and candles at their intended proportions without relying on
 * preserveAspectRatio="none", which non-uniformly scales every glyph.
 */
function useResponsiveChartWidth(fallback = VIEW_WIDTH) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    if (!node) return;
    const update = () => {
      const next = Math.max(1, Math.round(node.clientWidth));
      setWidth((current) => (Math.abs(current - next) > 1 ? next : current));
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { width, surfaceRef: setNode };
}

function PlotTooltip({
  tip,
  viewWidth,
  viewHeight,
}: {
  tip: PlotTip;
  viewWidth: number;
  viewHeight: number;
}) {
  const placeLeft = tip.x > viewWidth * 0.67;
  const placeAbove = tip.y > viewHeight * 0.7;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        zIndex: 5,
        left: `${clamp((tip.x / viewWidth) * 100, 0, 100)}%`,
        top: `${clamp((tip.y / viewHeight) * 100, 0, 100)}%`,
        transform: `translate(${placeLeft ? "calc(-100% - 10px)" : "10px"}, ${
          placeAbove ? "calc(-100% - 8px)" : "8px"
        })`,
        pointerEvents: "none",
        minWidth: 144,
        maxWidth: 240,
        padding: "8px 10px",
        borderRadius: 7,
        border: "1px solid var(--hair, rgba(255,255,255,.09))",
        background: "var(--bg-2, #101215)",
        color: P.ink,
        fontFamily: FONT,
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      <div
        style={{
          marginBottom: 6,
          color: P.muted,
          fontSize: 10.5,
          letterSpacing: ".035em",
        }}
      >
        {tip.title}
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        {tip.rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <span style={{ color: P.muted }}>{row.label}</span>
            <span
              style={{
                color: row.color ?? P.ink,
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuantVizEmptyState({
  height = 220,
  label = "No market data available",
  className,
}: {
  height?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      role="status"
      style={{
        ...shellStyle,
        height,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div style={{ textAlign: "center", color: P.muted2 }}>
        <svg
          aria-hidden="true"
          width="54"
          height="30"
          viewBox="0 0 54 30"
          style={{ display: "block", margin: "0 auto 10px" }}
        >
          <path
            d="M2 23 L12 17 L20 20 L30 8 L39 14 L52 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeDasharray="3 4"
          />
          <line
            x1="2"
            y1="28"
            x2="52"
            y2="28"
            stroke="currentColor"
            opacity=".45"
          />
        </svg>
        <div style={{ fontSize: 11, letterSpacing: ".025em" }}>{label}</div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number) {
  return Number.isFinite(value);
}

function extent(values: number[], padding = 0.06): [number, number] {
  const clean = values.filter(finite);
  if (!clean.length) return [0, 1];
  let min = Math.min(...clean);
  let max = Math.max(...clean);
  if (min === max) {
    const spread = Math.abs(min) * 0.08 || 1;
    min -= spread;
    max += spread;
  }
  const pad = (max - min) * padding;
  return [min - pad, max + pad];
}

function linearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
) {
  const span = domainMax - domainMin || 1;
  return (value: number) =>
    rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

function ticks(min: number, max: number, count = 4) {
  return Array.from(
    { length: count },
    (_, i) => min + ((max - min) * i) / Math.max(1, count - 1),
  );
}

function sampleIndices(length: number, count = 5) {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const indices = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    indices.add(Math.round((i * (length - 1)) / (count - 1)));
  }
  return [...indices];
}

function pointerInViewBox(
  event: ReactMouseEvent<SVGSVGElement>,
  width: number,
  height: number,
) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * width,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * height,
  };
}

function polylinePath(points: { x: number; y: number }[]) {
  return points
    .filter((point) => finite(point.x) && finite(point.y))
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
}

function rgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return hex;
  const n = Number.parseInt(value, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp(
    alpha,
    0,
    1,
  )})`;
}

function compact(value: number, digits = 1) {
  if (!finite(value)) return "—";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1e12) return `${sign}${(absolute / 1e12).toFixed(digits)}T`;
  if (absolute >= 1e9) return `${sign}${(absolute / 1e9).toFixed(digits)}B`;
  if (absolute >= 1e6) return `${sign}${(absolute / 1e6).toFixed(digits)}M`;
  if (absolute >= 1e3) return `${sign}${(absolute / 1e3).toFixed(digits)}K`;
  return `${sign}${absolute.toFixed(absolute < 10 ? digits : 0)}`;
}

function money(value: number) {
  if (!finite(value)) return "—";
  return `${value < 0 ? "−" : ""}$${compact(Math.abs(value))}`;
}

function percentage(value: number, digits = 2, signed = true) {
  if (!finite(value)) return "—";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function priceLabel(value: number, decimals?: number) {
  if (!finite(value)) return "—";
  const places =
    decimals ??
    (Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 10 ? 2 : 4);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
}

function timeLabel(value: QuantTime) {
  if (typeof value === "number") {
    if (value > 10_000_000_000) {
      return new Date(value).toLocaleString("en-GB", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      });
    }
    return String(value);
  }
  const parsed = Date.parse(value);
  if (
    finite(parsed) &&
    /[-T:/]/.test(value) &&
    (value.includes("T") || /^\d{4}-\d{2}/.test(value))
  ) {
    return new Date(parsed).toLocaleString("en-GB", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
  }
  return value;
}

function shortTimeLabel(value: QuantTime) {
  const label = timeLabel(value);
  return label.length > 13 ? label.slice(0, 13) : label;
}

function LegendMark({
  color,
  label,
  kind = "line",
}: {
  color: string;
  label: string;
  kind?: "line" | "box" | "dash";
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color: P.muted,
        fontSize: 11,
        whiteSpace: "nowrap",
      }}
    >
      <i
        style={{
          display: "block",
          width: kind === "box" ? 7 : 11,
          height: kind === "box" ? 7 : 1,
          borderRadius: kind === "box" ? 2 : 0,
          background: kind === "dash" ? "transparent" : color,
          borderTop: kind === "dash" ? `1px dashed ${color}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Candlestick + volume + funding                                             */
/* -------------------------------------------------------------------------- */

export interface CandleDatum {
  time: QuantTime;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  fundingRatePct: number;
}

export interface CandlestickFundingChartProps extends QuantVizBaseProps {
  data: CandleDatum[];
  priceDecimals?: number;
  fundingLabel?: string;
}

export function CandlestickFundingChart({
  data,
  height = 360,
  className,
  emptyLabel,
  priceDecimals,
  fundingLabel = "Funding / 8h",
}: CandlestickFundingChartProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const { width: W, surfaceRef } = useResponsiveChartWidth();
  const clean = data.filter(
    (d) =>
      finite(d.open) &&
      finite(d.high) &&
      finite(d.low) &&
      finite(d.close) &&
      finite(d.volume) &&
      finite(d.fundingRatePct),
  );
  const H = Math.max(280, height);
  if (!clean.length) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "No candle history"}
        className={className}
      />
    );
  }

  const pad = { left: 58, right: 62, top: 28, bottom: 28 };
  const candleBottom = H * 0.66;
  const volumeTop = H * 0.74;
  const volumeBottom = H - pad.bottom;
  const innerWidth = W - pad.left - pad.right;
  const [priceMin, priceMax] = extent(
    clean.flatMap((d) => [d.low, d.high]),
    0.04,
  );
  // Adaptive decimals from the visible price span so axis ticks never collapse to
  // the same rounded number (e.g. a gold market trading in a ~$2 band near $4,015).
  const priceSpan = Math.max(1e-9, priceMax - priceMin);
  const rdec = priceDecimals ?? clamp(Math.ceil(-Math.log10(priceSpan / 5)) + 1, 0, 6);
  const [fundingMinRaw, fundingMaxRaw] = extent(
    clean.map((d) => d.fundingRatePct).concat(0),
    0.12,
  );
  const fundingMin = Math.min(0, fundingMinRaw);
  const fundingMax = Math.max(0, fundingMaxRaw);
  const yPrice = linearScale(priceMin, priceMax, candleBottom, pad.top);
  const yFunding = linearScale(
    fundingMin,
    fundingMax,
    candleBottom - 8,
    pad.top + 8,
  );
  const maxVolume = Math.max(1, ...clean.map((d) => d.volume));
  const xAt = (index: number) =>
    pad.left + ((index + 0.5) / clean.length) * innerWidth;
  const bodyWidth = clamp((innerWidth / clean.length) * 0.58, 2, 14);
  const fundingPath = polylinePath(
    clean.map((d, index) => ({
      x: xAt(index),
      y: yFunding(d.fundingRatePct),
    })),
  );

  const onMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    const pointer = pointerInViewBox(event, W, H);
    if (pointer.x < pad.left || pointer.x > W - pad.right) {
      setTip(null);
      return;
    }
    const index = clamp(
      Math.floor(((pointer.x - pad.left) / innerWidth) * clean.length),
      0,
      clean.length - 1,
    );
    const candle = clean[index];
    const color = candle.close >= candle.open ? P.long : P.short;
    setTip({
      x: xAt(index),
      y: clamp(pointer.y, pad.top, volumeBottom),
      title: timeLabel(candle.time),
      rows: [
        { label: "Open", value: priceLabel(candle.open, rdec) },
        { label: "High", value: priceLabel(candle.high, rdec) },
        { label: "Low", value: priceLabel(candle.low, rdec) },
        {
          label: "Close",
          value: priceLabel(candle.close, rdec),
          color,
        },
        { label: "Volume", value: money(candle.volume) },
        {
          label: fundingLabel,
          value: percentage(candle.fundingRatePct, 4),
          color: candle.fundingRatePct >= 0 ? P.long : P.short,
        },
      ],
    });
  };

  return (
    <ChartSurface
      height={H}
      viewWidth={W}
      viewHeight={H}
      label="Candlestick chart with volume and funding overlay"
      className={className}
      tip={tip}
      surfaceRef={surfaceRef}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 7,
          left: 12,
          zIndex: 2,
          display: "flex",
          gap: 12,
          pointerEvents: "none",
        }}
      >
        <LegendMark color={P.price} label="Price" />
        <LegendMark color={P.slate} label="Volume" kind="box" />
        <LegendMark color={P.warning} label={fundingLabel} kind="dash" />
      </div>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
        style={{ display: "block", fontFamily: FONT }}
      >
        {ticks(priceMin, priceMax, 5).map((value) => {
          const y = yPrice(value);
          return (
            <g key={value}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
                stroke={P.grid}
                strokeDasharray="2 5"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={pad.left - 8}
                y={y + 3}
                fill={P.muted2}
                fontSize="10.5"
                textAnchor="end"
              >
                {priceLabel(value, rdec)}
              </text>
            </g>
          );
        })}
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={volumeTop - 6}
          y2={volumeTop - 6}
          stroke={P.axis}
          vectorEffect="non-scaling-stroke"
        />
        {clean.map((candle, index) => {
          const x = xAt(index);
          const up = candle.close >= candle.open;
          const color = up ? P.long : P.short;
          const openY = yPrice(candle.open);
          const closeY = yPrice(candle.close);
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1.25, Math.abs(closeY - openY));
          const volumeHeight =
            (Math.max(0, candle.volume) / maxVolume) *
            (volumeBottom - volumeTop);
          return (
            <g key={`${String(candle.time)}-${index}`}>
              <line
                x1={x}
                x2={x}
                y1={yPrice(candle.high)}
                y2={yPrice(candle.low)}
                stroke={color}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={x - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                rx=".75"
                fill={up ? rgba(color, 0.52) : color}
                stroke={color}
                strokeWidth=".8"
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={x - bodyWidth / 2}
                y={volumeBottom - volumeHeight}
                width={bodyWidth}
                height={Math.max(1, volumeHeight)}
                rx="1"
                fill={rgba(color, 0.33)}
              />
            </g>
          );
        })}
        <path
          d={fundingPath}
          fill="none"
          stroke={P.warning}
          strokeWidth="1.2"
          strokeDasharray="4 3"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={yFunding(0)}
          y2={yFunding(0)}
          stroke={rgba(P.warning, 0.22)}
          vectorEffect="non-scaling-stroke"
        />
        {tip ? (
          <line
            x1={tip.x}
            x2={tip.x}
            y1={pad.top}
            y2={volumeBottom}
            stroke={rgba(P.price, 0.3)}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {sampleIndices(clean.length, W < 440 ? 3 : 5).map((index) => (
          <text
            key={index}
            x={xAt(index)}
            y={H - 9}
            fill={P.muted2}
            fontSize="10.5"
            textAnchor="middle"
          >
            {shortTimeLabel(clean[index].time)}
          </text>
        ))}
        <text
          x={W - 7}
          y={yFunding(fundingMax) + 3}
          fill={P.warning}
          fontSize="10.5"
          textAnchor="end"
        >
          {percentage(fundingMax, 3, false)}
        </text>
        <text
          x={W - 7}
          y={yFunding(fundingMin) + 3}
          fill={P.warning}
          fontSize="10.5"
          textAnchor="end"
        >
          {percentage(fundingMin, 3, false)}
        </text>
      </svg>
    </ChartSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Cumulative order-book depth                                                */
/* -------------------------------------------------------------------------- */

export interface DepthLevel {
  price: number;
  size: number;
  cumulative?: number;
}

export interface CumulativeDepthChartProps extends QuantVizBaseProps {
  bids: DepthLevel[];
  asks: DepthLevel[];
  midPrice?: number;
  priceDecimals?: number;
}

type NormalizedDepth = DepthLevel & {
  cumulative: number;
  side: "bid" | "ask";
};

function normalizeDepth(
  levels: DepthLevel[],
  side: "bid" | "ask",
): NormalizedDepth[] {
  const sorted = levels
    .filter((level) => finite(level.price) && finite(level.size))
    .sort((a, b) =>
      side === "bid" ? b.price - a.price : a.price - b.price,
    );
  let running = 0;
  const normalized = sorted.map((level) => {
    running += Math.max(0, level.size);
    return {
      ...level,
      side,
      cumulative:
        level.cumulative !== undefined && finite(level.cumulative)
          ? Math.max(0, level.cumulative)
          : running,
    };
  });
  return side === "bid" ? normalized.reverse() : normalized;
}

export function CumulativeDepthChart({
  bids,
  asks,
  midPrice,
  priceDecimals,
  height = 290,
  className,
  emptyLabel,
}: CumulativeDepthChartProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const { width: W, surfaceRef } = useResponsiveChartWidth();
  const bidData = normalizeDepth(bids, "bid");
  const askData = normalizeDepth(asks, "ask");
  const all = [...bidData, ...askData];
  const H = Math.max(220, height);
  if (!all.length) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "Order book is empty"}
        className={className}
      />
    );
  }
  const pad = { left: 56, right: 18, top: 22, bottom: 30 };
  const [minPrice, maxPrice] = extent(
    all.map((level) => level.price),
    0.03,
  );
  const maxDepth = Math.max(1, ...all.map((level) => level.cumulative));
  const xPrice = linearScale(
    minPrice,
    maxPrice,
    pad.left,
    W - pad.right,
  );
  const yDepth = linearScale(maxDepth, 0, pad.top, H - pad.bottom);
  const baseline = H - pad.bottom;
  const bidPoints = bidData.map((level) => ({
    x: xPrice(level.price),
    y: yDepth(level.cumulative),
  }));
  const askPoints = askData.map((level) => ({
    x: xPrice(level.price),
    y: yDepth(level.cumulative),
  }));
  const bestBid = bidData.length
    ? Math.max(...bidData.map((level) => level.price))
    : undefined;
  const bestAsk = askData.length
    ? Math.min(...askData.map((level) => level.price))
    : undefined;
  const midpoint =
    midPrice ??
    (bestBid !== undefined && bestAsk !== undefined
      ? (bestBid + bestAsk) / 2
      : all.reduce((sum, level) => sum + level.price, 0) / all.length);

  const area = (points: { x: number; y: number }[]) =>
    points.length
      ? `${polylinePath(points)} L${points[points.length - 1].x},${baseline} L${
          points[0].x
        },${baseline} Z`
      : "";

  const onMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    const pointer = pointerInViewBox(event, W, H);
    const nearest = all.reduce<NormalizedDepth | null>((best, level) => {
      if (!best) return level;
      return Math.abs(xPrice(level.price) - pointer.x) <
        Math.abs(xPrice(best.price) - pointer.x)
        ? level
        : best;
    }, null);
    if (!nearest) return;
    const color = nearest.side === "bid" ? P.long : P.short;
    setTip({
      x: xPrice(nearest.price),
      y: yDepth(nearest.cumulative),
      title: nearest.side === "bid" ? "Cumulative bids" : "Cumulative asks",
      rows: [
        { label: "Price", value: priceLabel(nearest.price, priceDecimals) },
        { label: "Level size", value: compact(nearest.size), color },
        { label: "Cumulative", value: compact(nearest.cumulative), color },
      ],
    });
  };

  return (
    <ChartSurface
      height={H}
      viewWidth={W}
      viewHeight={H}
      label="Cumulative bid and ask depth chart"
      className={className}
      tip={tip}
      surfaceRef={surfaceRef}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
        style={{ display: "block", fontFamily: FONT }}
      >
        {ticks(0, maxDepth, 4).map((depth) => {
          const y = yDepth(depth);
          return (
            <g key={depth}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
                stroke={P.grid}
                strokeDasharray="2 5"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={pad.left - 8}
                y={y + 3}
                fill={P.muted2}
                fontSize="10.5"
                textAnchor="end"
              >
                {compact(depth)}
              </text>
            </g>
          );
        })}
        {bidPoints.length ? (
          <>
            <path d={area(bidPoints)} fill={rgba(P.long, 0.13)} />
            <path
              d={polylinePath(bidPoints)}
              fill="none"
              stroke={P.long}
              strokeWidth="1.6"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
        {askPoints.length ? (
          <>
            <path d={area(askPoints)} fill={rgba(P.short, 0.13)} />
            <path
              d={polylinePath(askPoints)}
              fill="none"
              stroke={P.short}
              strokeWidth="1.6"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
        {midpoint >= minPrice && midpoint <= maxPrice ? (
          <g>
            <line
              x1={xPrice(midpoint)}
              x2={xPrice(midpoint)}
              y1={pad.top}
              y2={baseline}
              stroke={rgba(P.accent, 0.62)}
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={xPrice(midpoint)}
              y={pad.top - 7}
              fill={P.accent}
              fontSize="10.5"
              textAnchor="middle"
            >
              MID {priceLabel(midpoint, priceDecimals)}
            </text>
          </g>
        ) : null}
        {ticks(minPrice, maxPrice, W < 440 ? 3 : 5).map((value) => (
          <text
            key={value}
            x={xPrice(value)}
            y={H - 10}
            fill={P.muted2}
            fontSize="10.5"
            textAnchor="middle"
          >
            {priceLabel(value, priceDecimals)}
          </text>
        ))}
        {tip ? (
          <>
            <line
              x1={tip.x}
              x2={tip.x}
              y1={pad.top}
              y2={baseline}
              stroke={rgba(P.price, 0.28)}
              strokeDasharray="2 3"
            />
            <circle cx={tip.x} cy={tip.y} r="3" fill={P.price} />
          </>
        ) : null}
      </svg>
    </ChartSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Liquidity heatmap                                                          */
/* -------------------------------------------------------------------------- */

export interface LiquidityCell {
  time: QuantTime;
  price: number;
  liquidity: number;
  side?: "bid" | "ask" | "neutral";
  orders?: number;
}

export interface LiquidityHeatmapChartProps extends QuantVizBaseProps {
  data: LiquidityCell[];
  currentPrice?: number;
  priceDecimals?: number;
}

export function LiquidityHeatmapChart({
  data,
  currentPrice,
  priceDecimals,
  height = 330,
  className,
  emptyLabel,
}: LiquidityHeatmapChartProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const [activeLevel, setActiveLevel] = useState<string | null>(null);
  const { width: W, surfaceRef } = useResponsiveChartWidth();
  const clean = data.filter(
    (cell) =>
      finite(cell.price) &&
      finite(cell.liquidity) &&
      cell.liquidity >= 0,
  );
  const H = Math.max(240, height);
  if (!clean.length) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "No resting liquidity"}
        className={className}
      />
    );
  }

  // This component is fed a single live order-book snapshot. A time/price
  // heatmap made every level the same width, leaving liquidity encoded only by
  // faint opacity. Use a mirrored price ladder instead: bar length and colour
  // now expose the actual notional at each level immediately.
  const levels = [...clean].sort((a, b) => b.price - a.price);
  const pad = { left: 16, right: 16, top: 29, bottom: 24 };
  const innerWidth = W - pad.left - pad.right;
  const innerHeight = H - pad.top - pad.bottom;
  const priceLane = clamp(W * 0.16, 62, 82);
  const centerX = W / 2;
  const leftEnd = centerX - priceLane / 2;
  const rightStart = centerX + priceLane / 2;
  const laneWidth = Math.max(24, (innerWidth - priceLane) / 2);
  const rowHeight = innerHeight / Math.max(1, levels.length);
  const barHeight = clamp(rowHeight * 0.68, 2.5, 8);
  const maxLiquidity = Math.max(1, ...levels.map((cell) => cell.liquidity));
  const markerIndex = currentPrice !== undefined && finite(currentPrice)
    ? (() => {
        const index = levels.findIndex((cell) => cell.price <= currentPrice);
        return index >= 0 ? index : (currentPrice > levels[0].price ? 0 : levels.length);
      })()
    : -1;
  const yCurrent = markerIndex >= 0
    ? clamp(pad.top + markerIndex * rowHeight, pad.top, H - pad.bottom)
    : null;
  const currentLabel = priceLabel(currentPrice ?? 0, priceDecimals);
  const currentLabelWidth = clamp(currentLabel.length * 6.4 + 12, 54, 90);

  const showLevel = (cell: LiquidityCell, index: number, x: number, y: number) => {
    const color = cell.side === "bid" ? P.long : cell.side === "ask" ? P.short : P.slateLight;
    const key = `${cell.price}-${cell.side ?? "neutral"}-${index}`;
    setActiveLevel(key);
    setTip({
      x,
      y,
      title: cell.side === "bid" ? "Bid liquidity" : cell.side === "ask" ? "Ask liquidity" : "Resting liquidity",
      rows: [
        { label: "Price", value: priceLabel(cell.price, priceDecimals) },
        { label: "Notional", value: money(cell.liquidity), color },
        { label: "Book side", value: (cell.side ?? "neutral").toUpperCase(), color },
        { label: "Relative size", value: percentage((cell.liquidity / maxLiquidity) * 100, 1, false) },
        ...(cell.orders !== undefined ? [{ label: "Orders", value: compact(cell.orders, 0) }] : []),
      ],
    });
  };

  const clearLevel = () => {
    setTip(null);
    setActiveLevel(null);
  };

  return (
    <ChartSurface
      height={H}
      viewWidth={W}
      viewHeight={H}
      label="Price-band liquidity ladder with bid and ask notional"
      className={className}
      tip={tip}
      surfaceRef={surfaceRef}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={clearLevel}
        style={{ display: "block", fontFamily: FONT }}
      >
        <text x={pad.left} y="14" fill={P.long} fontSize="10" fontWeight="700" letterSpacing=".08em">
          BID DEPTH
        </text>
        <text x={centerX} y="14" fill={P.muted2} fontSize="10" fontWeight="700" textAnchor="middle" letterSpacing=".08em">
          PRICE
        </text>
        <text x={W - pad.right} y="14" fill={P.short} fontSize="10" fontWeight="700" textAnchor="end" letterSpacing=".08em">
          ASK DEPTH
        </text>
        <rect
          x={pad.left}
          y={pad.top}
          width={laneWidth}
          height={innerHeight}
          fill="rgba(127,145,160,.025)"
        />
        <rect
          x={rightStart}
          y={pad.top}
          width={laneWidth}
          height={innerHeight}
          fill="rgba(127,145,160,.025)"
        />
        <line x1={leftEnd} x2={leftEnd} y1={pad.top} y2={H - pad.bottom} stroke={P.axis} />
        <line x1={rightStart} x2={rightStart} y1={pad.top} y2={H - pad.bottom} stroke={P.axis} />
        {levels.map((cell, index) => {
          const y = pad.top + (index + 0.5) * rowHeight;
          const magnitude = Math.sqrt(cell.liquidity / maxLiquidity);
          const color =
            cell.side === "bid"
              ? P.long
              : cell.side === "ask"
                ? P.short
                : P.slateLight;
          const barWidth = Math.max(2, magnitude * laneWidth);
          const isBid = cell.side === "bid";
          const x = isBid ? leftEnd - barWidth : rightStart;
          const key = `${cell.price}-${cell.side ?? "neutral"}-${index}`;
          const active = activeLevel === key;
          return (
            <rect
              key={key}
              role="button"
              tabIndex={0}
              aria-label={`${cell.side ?? "neutral"} liquidity at ${priceLabel(cell.price, priceDecimals)}: ${money(cell.liquidity)}`}
              x={x}
              y={y - barHeight / 2}
              width={barWidth}
              height={barHeight}
              rx={Math.min(3, barHeight / 2)}
              fill={rgba(color, 0.34 + magnitude * 0.52)}
              stroke={active ? color : "transparent"}
              strokeWidth={active ? 1.25 : 0}
              style={{ cursor: "pointer", outline: "none" }}
              onMouseEnter={() => showLevel(cell, index, isBid ? x : x + barWidth, y)}
              onFocus={() => showLevel(cell, index, isBid ? x : x + barWidth, y)}
              onClick={() => showLevel(cell, index, isBid ? x : x + barWidth, y)}
              onBlur={clearLevel}
            />
          );
        })}
        {sampleIndices(levels.length, H < 280 ? 5 : 7).map((index) => (
          <text
            key={`${levels[index].price}-${index}`}
            x={centerX}
            y={pad.top + (index + 0.5) * rowHeight + 3.5}
            fill={P.muted2}
            fontSize="10"
            textAnchor="middle"
          >
            {priceLabel(levels[index].price, priceDecimals)}
          </text>
        ))}
        {yCurrent !== null &&
        yCurrent >= pad.top &&
        yCurrent <= H - pad.bottom ? (
          <g>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={yCurrent}
              y2={yCurrent}
              stroke={P.accent}
              strokeWidth="1"
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={centerX - currentLabelWidth / 2}
              y={yCurrent - 7}
              width={currentLabelWidth}
              height="17"
              rx="3"
              fill="var(--bg-2, #101215)"
              stroke={rgba(P.accent, 0.45)}
            />
            <text
              x={centerX}
              y={yCurrent + 3.5}
              fill={P.accent}
              fontSize="10.5"
              textAnchor="middle"
            >
              {currentLabel}
            </text>
          </g>
        ) : null}
        <text x={centerX} y={H - 7} fill={P.muted2} fontSize="9.5" textAnchor="middle" letterSpacing=".04em">
          BAR LENGTH = NOTIONAL
        </text>
      </svg>
    </ChartSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Spread / order-book imbalance dial                                         */
/* -------------------------------------------------------------------------- */

export interface SpreadImbalanceDialProps extends QuantVizBaseProps {
  spreadBps: number;
  imbalance: number;
  bidDepth?: number;
  askDepth?: number;
  spreadWarningBps?: number;
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  return `M${start.x},${start.y} A${radius},${radius} 0 ${
    endAngle - startAngle > 180 ? 1 : 0
  } 1 ${end.x},${end.y}`;
}

export function SpreadImbalanceDial({
  spreadBps,
  imbalance,
  bidDepth = 0,
  askDepth = 0,
  spreadWarningBps = 10,
  height = 230,
  className,
  emptyLabel,
}: SpreadImbalanceDialProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const { width: W, surfaceRef } = useResponsiveChartWidth(440);
  const H = Math.max(190, height);
  if (!finite(spreadBps) || !finite(imbalance)) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "Spread data unavailable"}
        className={className}
      />
    );
  }
  const cx = W / 2;
  const cy = H * 0.56;
  const radius = Math.max(28, Math.min(126, H * 0.45, (W - 72) / 2));
  const barInset = clamp(W * 0.08, 24, 34);
  const barWidth = Math.max(1, W - barInset * 2);
  const normalized = clamp(imbalance, -1, 1);
  const angle = 195 + ((normalized + 1) / 2) * 150;
  const needle = polarPoint(cx, cy, radius - 20, angle);
  const spreadColor =
    spreadBps > spreadWarningBps ? P.short : spreadBps > spreadWarningBps * 0.6 ? P.warning : P.long;
  const totalDepth = Math.max(1, bidDepth + askDepth);
  const bidShare = clamp((bidDepth / totalDepth) * 100, 0, 100);
  const segments = Array.from({ length: 15 }, (_, i) => {
    const start = 195 + i * 10.1;
    const end = start + 7;
    const midpoint = (start + end) / 2;
    const color =
      midpoint < 245 ? P.short : midpoint > 295 ? P.long : P.slate;
    return { start, end, color };
  });
  const imbalanceLabel =
    Math.abs(normalized) < 0.08
      ? "BALANCED"
      : normalized > 0
        ? "BID HEAVY"
        : "ASK HEAVY";

  return (
    <ChartSurface
      height={H}
      viewWidth={W}
      viewHeight={H}
      label="Spread and order book imbalance dial"
      className={className}
      tip={tip}
      surfaceRef={surfaceRef}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setTip(null)}
        style={{ display: "block", fontFamily: FONT }}
      >
        <g
          onMouseEnter={() =>
            setTip({
              x: cx,
              y: cy - radius * 0.45,
              title: "Top-of-book health",
              rows: [
                { label: "Spread", value: `${spreadBps.toFixed(2)} bps`, color: spreadColor },
                {
                  label: "Imbalance",
                  value: `${normalized >= 0 ? "+" : ""}${(normalized * 100).toFixed(1)}%`,
                  color: normalized >= 0 ? P.long : P.short,
                },
                { label: "Bid depth", value: money(bidDepth), color: P.long },
                { label: "Ask depth", value: money(askDepth), color: P.short },
              ],
            })
          }
        >
          {segments.map((segment, index) => (
            <path
              key={index}
              d={arcPath(cx, cy, radius, segment.start, segment.end)}
              fill="none"
              stroke={rgba(segment.color, 0.56)}
              strokeWidth="10"
              strokeLinecap="butt"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            x1={cx}
            y1={cy}
            x2={needle.x}
            y2={needle.y}
            stroke={P.price}
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={cx} cy={cy} r="5" fill={P.price} />
          <circle
            cx={cx}
            cy={cy}
            r="9"
            fill="none"
            stroke={rgba(P.price, 0.25)}
          />
        </g>
        <text
          x={cx}
          y={cy - 36}
          fill={spreadColor}
          fontSize="25"
          fontWeight="700"
          fontFamily={MONO}
          textAnchor="middle"
        >
          {spreadBps.toFixed(2)}
        </text>
        <text
          x={cx}
          y={cy - 17}
          fill={P.muted}
          fontSize="10.5"
          letterSpacing=".12em"
          textAnchor="middle"
        >
          SPREAD BPS
        </text>
        <text
          x={cx - radius}
          y={cy + 19}
          fill={P.short}
          fontSize="10.5"
          textAnchor="start"
        >
          ASK
        </text>
        <text
          x={cx + radius}
          y={cy + 19}
          fill={P.long}
          fontSize="10.5"
          textAnchor="end"
        >
          BID
        </text>
        <text
          x={cx}
          y={cy + 28}
          fill={normalized >= 0 ? P.long : P.short}
          fontSize="11"
          fontWeight="700"
          letterSpacing=".1em"
          textAnchor="middle"
        >
          {imbalanceLabel}
        </text>
        <g transform={`translate(${barInset} ${H - 28})`}>
          <rect
            x="0"
            y="0"
            width={barWidth}
            height="7"
            rx="3.5"
            fill="rgba(127,145,160,.12)"
          />
          <rect
            x="0"
            y="0"
            width={(barWidth * bidShare) / 100}
            height="7"
            rx="3.5"
            fill={rgba(P.long, 0.76)}
          />
          <rect
            x={(barWidth * bidShare) / 100}
            y="0"
            width={(barWidth * (100 - bidShare)) / 100}
            height="7"
            rx="3.5"
            fill={rgba(P.short, 0.76)}
          />
          <text x="0" y="-6" fill={P.long} fontSize="10.5">
            BIDS {bidShare.toFixed(0)}%
          </text>
          <text x={barWidth} y="-6" fill={P.short} fontSize="10.5" textAnchor="end">
            {(100 - bidShare).toFixed(0)}% ASKS
          </text>
        </g>
      </svg>
    </ChartSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Funding term structure                                                     */
/* -------------------------------------------------------------------------- */

export interface FundingTermPoint {
  tenor: string;
  hours: number;
  ratePct: number;
}

export interface FundingTermSeries {
  name: string;
  color?: string;
  points: FundingTermPoint[];
}

export interface FundingTermStructureChartProps extends QuantVizBaseProps {
  series: FundingTermSeries[];
}

const SERIES_COLORS = [
  P.long,
  P.slateLight,
  P.warning,
  P.short,
  "#9b8fba",
  "#6ba3ad",
] as const;

export function FundingTermStructureChart({
  series,
  height = 290,
  className,
  emptyLabel,
}: FundingTermStructureChartProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const cleanSeries = series
    .map((item) => ({
      ...item,
      points: item.points
        .filter((point) => finite(point.hours) && finite(point.ratePct))
        .sort((a, b) => a.hours - b.hours),
    }))
    .filter((item) => item.points.length);
  const allPoints = cleanSeries.flatMap((item) => item.points);
  const H = Math.max(220, height);
  if (!allPoints.length) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "No funding curve data"}
        className={className}
      />
    );
  }
  const pad = { left: 55, right: 20, top: 34, bottom: 32 };
  const [hourMin, hourMax] = extent(
    allPoints.map((point) => point.hours),
    0.02,
  );
  const [rateMinRaw, rateMaxRaw] = extent(
    allPoints.map((point) => point.ratePct).concat(0),
    0.12,
  );
  const rateMin = Math.min(0, rateMinRaw);
  const rateMax = Math.max(0, rateMaxRaw);
  const xHour = linearScale(
    hourMin,
    hourMax,
    pad.left,
    VIEW_WIDTH - pad.right,
  );
  const yRate = linearScale(rateMin, rateMax, H - pad.bottom, pad.top);
  const hourValues = [
    ...new Set(allPoints.map((point) => point.hours)),
  ].sort((a, b) => a - b);
  const tenorFor = (hour: number) =>
    allPoints.find((point) => point.hours === hour)?.tenor ??
    (hour < 24 ? `${hour}h` : `${hour / 24}d`);

  const onMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    const pointer = pointerInViewBox(event, VIEW_WIDTH, H);
    const nearestHour = hourValues.reduce((best, hour) =>
      Math.abs(xHour(hour) - pointer.x) < Math.abs(xHour(best) - pointer.x)
        ? hour
        : best,
    );
    const rows = cleanSeries.map((item, index) => {
      const point = item.points.reduce((best, candidate) =>
        Math.abs(candidate.hours - nearestHour) <
        Math.abs(best.hours - nearestHour)
          ? candidate
          : best,
      );
      return {
        label: item.name,
        value: percentage(point.ratePct, 3),
        color: item.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
      };
    });
    setTip({
      x: xHour(nearestHour),
      y: clamp(pointer.y, pad.top, H - pad.bottom),
      title: tenorFor(nearestHour),
      rows,
    });
  };

  return (
    <ChartSurface
      height={H}
      viewWidth={VIEW_WIDTH}
      viewHeight={H}
      label="Funding rate term structure"
      className={className}
      tip={tip}
    >
      <div
        style={{
          position: "absolute",
          top: 7,
          left: 12,
          right: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 12px",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        {cleanSeries.map((item, index) => (
          <LegendMark
            key={item.name}
            color={item.color ?? SERIES_COLORS[index % SERIES_COLORS.length]}
            label={item.name}
          />
        ))}
      </div>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_WIDTH} ${H}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
        style={{ display: "block", fontFamily: FONT }}
      >
        {ticks(rateMin, rateMax, 5).map((rate) => {
          const y = yRate(rate);
          return (
            <g key={rate}>
              <line
                x1={pad.left}
                x2={VIEW_WIDTH - pad.right}
                y1={y}
                y2={y}
                stroke={rate === 0 ? P.axis : P.grid}
                strokeDasharray={rate === 0 ? undefined : "2 5"}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={pad.left - 8}
                y={y + 3}
                fill={P.muted2}
                fontSize="9"
                textAnchor="end"
              >
                {percentage(rate, 2, false)}
              </text>
            </g>
          );
        })}
        {cleanSeries.map((item, index) => {
          const color =
            item.color ?? SERIES_COLORS[index % SERIES_COLORS.length];
          const points = item.points.map((point) => ({
            x: xHour(point.hours),
            y: yRate(point.ratePct),
          }));
          return (
            <g key={item.name}>
              <path
                d={polylinePath(points)}
                fill="none"
                stroke={color}
                strokeWidth="1.55"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((point, pointIndex) => (
                <circle
                  key={pointIndex}
                  cx={point.x}
                  cy={point.y}
                  r="2"
                  fill="var(--bg-2, #101215)"
                  stroke={color}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          );
        })}
        {sampleIndices(hourValues.length, 6).map((index) => {
          const hour = hourValues[index];
          return (
            <text
              key={hour}
              x={xHour(hour)}
              y={H - 10}
              fill={P.muted2}
              fontSize="9"
              textAnchor="middle"
            >
              {tenorFor(hour)}
            </text>
          );
        })}
        {tip ? (
          <line
            x1={tip.x}
            x2={tip.x}
            y1={pad.top}
            y2={H - pad.bottom}
            stroke={rgba(P.price, 0.3)}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </ChartSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Basis / OI / price overlay                                                 */
/* -------------------------------------------------------------------------- */

export interface BasisOiPriceDatum {
  time: QuantTime;
  price: number;
  openInterest: number;
  basisPct: number;
}

export interface BasisOiPriceChartProps extends QuantVizBaseProps {
  data: BasisOiPriceDatum[];
  priceDecimals?: number;
}

export function BasisOiPriceChart({
  data,
  priceDecimals,
  height = 310,
  className,
  emptyLabel,
}: BasisOiPriceChartProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const { width: W, surfaceRef } = useResponsiveChartWidth();
  const clean = data.filter(
    (item) =>
      finite(item.price) &&
      finite(item.openInterest) &&
      finite(item.basisPct),
  );
  const H = Math.max(235, height);
  if (!clean.length) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "No basis or OI history"}
        className={className}
      />
    );
  }
  const pad = { left: 58, right: 56, top: 34, bottom: 30 };
  const innerWidth = W - pad.left - pad.right;
  const [priceMin, priceMax] = extent(
    clean.map((item) => item.price),
    0.08,
  );
  const [basisMinRaw, basisMaxRaw] = extent(
    clean.map((item) => item.basisPct).concat(0),
    0.12,
  );
  const basisMin = Math.min(0, basisMinRaw);
  const basisMax = Math.max(0, basisMaxRaw);
  const maxOi = Math.max(1, ...clean.map((item) => item.openInterest));
  const xAt = (index: number) =>
    pad.left + ((index + 0.5) / clean.length) * innerWidth;
  const yPrice = linearScale(priceMin, priceMax, H - pad.bottom, pad.top);
  const yBasis = linearScale(basisMin, basisMax, H - pad.bottom, pad.top);
  const pricePath = polylinePath(
    clean.map((item, index) => ({
      x: xAt(index),
      y: yPrice(item.price),
    })),
  );
  const basisPath = polylinePath(
    clean.map((item, index) => ({
      x: xAt(index),
      y: yBasis(item.basisPct),
    })),
  );

  const onMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    const pointer = pointerInViewBox(event, W, H);
    const index = clamp(
      Math.floor(((pointer.x - pad.left) / innerWidth) * clean.length),
      0,
      clean.length - 1,
    );
    const item = clean[index];
    setTip({
      x: xAt(index),
      y: clamp(pointer.y, pad.top, H - pad.bottom),
      title: timeLabel(item.time),
      rows: [
        { label: "Price", value: priceLabel(item.price, priceDecimals), color: P.price },
        { label: "Open interest", value: money(item.openInterest), color: P.slateLight },
        {
          label: "Basis",
          value: percentage(item.basisPct, 3),
          color: item.basisPct >= 0 ? P.long : P.short,
        },
      ],
    });
  };

  return (
    <ChartSurface
      height={H}
      viewWidth={W}
      viewHeight={H}
      label="Price with open interest and basis overlay"
      className={className}
      tip={tip}
      surfaceRef={surfaceRef}
    >
      <div
        style={{
          position: "absolute",
          top: 7,
          left: 12,
          display: "flex",
          gap: 12,
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <LegendMark color={P.price} label="Price" />
        <LegendMark color={P.slate} label="OI" kind="box" />
        <LegendMark color={P.warning} label="Basis" kind="dash" />
      </div>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
        style={{ display: "block", fontFamily: FONT }}
      >
        {ticks(priceMin, priceMax, 5).map((value) => {
          const y = yPrice(value);
          return (
            <g key={value}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
                stroke={P.grid}
                strokeDasharray="2 5"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={pad.left - 8}
                y={y + 3}
                fill={P.muted2}
                fontSize="10.5"
                textAnchor="end"
              >
                {priceLabel(value, priceDecimals)}
              </text>
            </g>
          );
        })}
        {clean.map((item, index) => {
          const barHeight =
            (Math.max(0, item.openInterest) / maxOi) * (H - pad.top - pad.bottom);
          const width = clamp((innerWidth / clean.length) * 0.7, 1, 12);
          return (
            <rect
              key={`${String(item.time)}-${index}`}
              x={xAt(index) - width / 2}
              y={H - pad.bottom - barHeight}
              width={width}
              height={barHeight}
              fill={rgba(P.slate, 0.18)}
            />
          );
        })}
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={yBasis(0)}
          y2={yBasis(0)}
          stroke={rgba(P.warning, 0.24)}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={pricePath}
          fill="none"
          stroke={P.price}
          strokeWidth="1.65"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={basisPath}
          fill="none"
          stroke={P.warning}
          strokeWidth="1.25"
          strokeDasharray="4 3"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {ticks(basisMin, basisMax, 3).map((value) => (
          <text
            key={value}
            x={W - 7}
            y={yBasis(value) + 3}
            fill={P.warning}
            fontSize="10.5"
            textAnchor="end"
          >
            {percentage(value, 2, false)}
          </text>
        ))}
        {sampleIndices(clean.length, W < 440 ? 3 : 5).map((index) => (
          <text
            key={index}
            x={xAt(index)}
            y={H - 10}
            fill={P.muted2}
            fontSize="10.5"
            textAnchor="middle"
          >
            {shortTimeLabel(clean[index].time)}
          </text>
        ))}
        {tip ? (
          <line
            x1={tip.x}
            x2={tip.x}
            y1={pad.top}
            y2={H - pad.bottom}
            stroke={rgba(P.price, 0.32)}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </ChartSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Realized volatility ranking                                                */
/* -------------------------------------------------------------------------- */

export interface RealizedVolItem {
  symbol: string;
  realizedVolPct: number;
  impliedVolPct?: number;
  changePct?: number;
}

export interface RealizedVolRankingChartProps extends QuantVizBaseProps {
  data: RealizedVolItem[];
  maxRows?: number;
}

export function RealizedVolRankingChart({
  data,
  maxRows = 10,
  height = 350,
  className,
  emptyLabel,
}: RealizedVolRankingChartProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const { width: W, surfaceRef } = useResponsiveChartWidth(680);
  const clean = data
    .filter((item) => item.symbol && finite(item.realizedVolPct))
    .sort((a, b) => b.realizedVolPct - a.realizedVolPct)
    .slice(0, Math.max(1, maxRows));
  const H = Math.max(240, height, 52 + clean.length * 30);
  if (!clean.length) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "No volatility observations"}
        className={className}
      />
    );
  }
  const pad = {
    left: W < 420 ? 76 : 100,
    right: 84,
    top: 30,
    bottom: 22,
  };
  const rowHeight = (H - pad.top - pad.bottom) / clean.length;
  const maxVol = Math.max(
    1,
    ...clean.flatMap((item) => [
      item.realizedVolPct,
      item.impliedVolPct ?? 0,
    ]),
  );
  const barWidth = (value: number) =>
    (Math.max(0, value) / maxVol) * (W - pad.left - pad.right);

  return (
    <ChartSurface
      height={H}
      viewWidth={W}
      viewHeight={H}
      label="Realized volatility ranking"
      className={className}
      tip={tip}
      surfaceRef={surfaceRef}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setTip(null)}
        style={{ display: "block", fontFamily: FONT }}
      >
        <text x={pad.left} y="17" fill={P.muted2} fontSize="10.5" letterSpacing=".07em">
          ANNUALISED VOLATILITY
        </text>
        <text x={W - 8} y="17" fill={P.muted2} fontSize="10.5" textAnchor="end">
          RV · 24H
        </text>
        {clean.map((item, index) => {
          const y = pad.top + index * rowHeight;
          const centerY = y + rowHeight / 2;
          const width = barWidth(item.realizedVolPct);
          const color = index < 3 ? P.warning : P.slate;
          const ivX =
            item.impliedVolPct !== undefined
              ? pad.left + barWidth(item.impliedVolPct)
              : null;
          const changeColor =
            (item.changePct ?? 0) >= 0 ? P.long : P.short;
          return (
            <g
              key={item.symbol}
              onMouseEnter={() =>
                setTip({
                  x: pad.left + width,
                  y: centerY,
                  title: `#${index + 1} ${item.symbol}`,
                  rows: [
                    {
                      label: "Realized vol",
                      value: percentage(item.realizedVolPct, 1, false),
                      color,
                    },
                    ...(item.impliedVolPct !== undefined
                      ? [
                          {
                            label: "Implied vol",
                            value: percentage(item.impliedVolPct, 1, false),
                            color: P.warning,
                          },
                          {
                            label: "IV − RV",
                            value: percentage(
                              item.impliedVolPct - item.realizedVolPct,
                              1,
                            ),
                          },
                        ]
                      : []),
                    ...(item.changePct !== undefined
                      ? [
                          {
                            label: "24h change",
                            value: percentage(item.changePct, 1),
                            color: changeColor,
                          },
                        ]
                      : []),
                  ],
                })
              }
            >
              <rect
                x="0"
                y={y + 1}
                width={W}
                height={Math.max(1, rowHeight - 2)}
                fill="transparent"
              />
              <text
                x="13"
                y={centerY + 3}
                fill={P.muted2}
                fontSize="10.5"
              >
                {String(index + 1).padStart(2, "0")}
              </text>
              <text
                x="39"
                y={centerY + 3}
                fill={P.ink}
                fontSize="11"
                fontWeight="650"
              >
                {item.symbol}
              </text>
              <rect
                x={pad.left}
                y={centerY - Math.min(7, rowHeight * 0.24)}
                width={W - pad.left - pad.right}
                height={Math.min(14, rowHeight * 0.48)}
                rx="2"
                fill="rgba(127,145,160,.07)"
              />
              <rect
                x={pad.left}
                y={centerY - Math.min(7, rowHeight * 0.24)}
                width={width}
                height={Math.min(14, rowHeight * 0.48)}
                rx="2"
                fill={rgba(color, 0.7)}
              />
              {ivX !== null ? (
                <line
                  x1={ivX}
                  x2={ivX}
                  y1={centerY - Math.min(10, rowHeight * 0.34)}
                  y2={centerY + Math.min(10, rowHeight * 0.34)}
                  stroke={P.warning}
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <text
                x={W - 49}
                y={centerY + 3}
                fill={P.ink}
                fontSize="10.5"
                fontFamily={MONO}
                textAnchor="end"
              >
                {item.realizedVolPct.toFixed(0)}%
              </text>
              <text
                x={W - 9}
                y={centerY + 3}
                fill={
                  item.changePct === undefined ? P.muted2 : changeColor
                }
                fontSize="10.5"
                fontFamily={MONO}
                textAnchor="end"
              >
                {item.changePct === undefined
                  ? "—"
                  : percentage(item.changePct, 0)}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Correlation matrix                                                         */
/* -------------------------------------------------------------------------- */

export interface CorrelationMatrixChartProps extends QuantVizBaseProps {
  symbols: string[];
  values: number[][];
  decimals?: number;
}

export function CorrelationMatrixChart({
  symbols,
  values,
  decimals = 2,
  height = 430,
  className,
  emptyLabel,
}: CorrelationMatrixChartProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const { width: surfaceWidth, surfaceRef } = useResponsiveChartWidth(500);
  const count = Math.min(symbols.length, values.length);
  const H = Math.max(280, height, 78 + count * 28);
  if (!count || !values.some((row) => row.some(finite))) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "No correlation window"}
        className={className}
      />
    );
  }
  const labelGutter = 52;
  const minimumCell = 28;
  const minimumWidth = labelGutter * 2 + count * minimumCell;
  const W = Math.max(surfaceWidth, minimumWidth);
  const padTop = 42;
  const bottomSpace = 36;
  const plotSize = Math.max(
    count * minimumCell,
    Math.min(W - labelGutter * 2, H - padTop - bottomSpace),
  );
  const cell = plotSize / count;
  const padLeft = (W - plotSize) / 2;
  const plotBottom = padTop + plotSize;
  const minWidth = W > surfaceWidth + 1 ? W : undefined;
  const legendWidth = Math.min(plotSize, 230);
  const legendItemWidth = legendWidth / 5;

  const colorFor = (value: number, diagonal: boolean) => {
    if (diagonal) return "rgba(145,160,174,.3)";
    const magnitude = clamp(Math.abs(value), 0, 1);
    if (magnitude < 0.04) return "rgba(127,145,160,.08)";
    return rgba(value >= 0 ? P.long : P.short, 0.1 + magnitude * 0.68);
  };

  return (
    <ChartSurface
      height={H}
      viewWidth={W}
      viewHeight={H}
      label="Asset return correlation matrix"
      className={className}
      tip={tip}
      minWidth={minWidth}
      surfaceRef={surfaceRef}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setTip(null)}
        style={{ display: "block", fontFamily: FONT }}
      >
        {symbols.slice(0, count).map((symbol, index) => (
          <g key={`${symbol}-${index}`}>
            <text
              x={padLeft - 9}
              y={padTop + index * cell + cell / 2 + 3}
              fill={P.muted}
              fontSize="11"
              fontWeight="600"
              textAnchor="end"
            >
              {symbol}
            </text>
            <text
              x={padLeft + index * cell + cell / 2}
              y={padTop - 9}
              fill={P.muted}
              fontSize="11"
              fontWeight="600"
              textAnchor="start"
              transform={`rotate(-38 ${padLeft + index * cell + cell / 2} ${padTop - 9})`}
            >
              {symbol}
            </text>
          </g>
        ))}
        {Array.from({ length: count }, (_, row) =>
          Array.from({ length: count }, (_, column) => {
            const raw = values[row]?.[column];
            if (!finite(raw)) return null;
            const value = clamp(raw, -1, 1);
            const x = padLeft + column * cell;
            const y = padTop + row * cell;
            const diagonal = row === column;
            return (
              <g
                key={`${row}-${column}`}
                onMouseEnter={() =>
                  setTip({
                    x: x + cell / 2,
                    y: y + cell / 2,
                    title: `${symbols[row]} × ${symbols[column]}`,
                    rows: [
                      {
                        label: "Correlation",
                        value: value.toFixed(decimals),
                        color:
                          value > 0.04
                            ? P.long
                            : value < -0.04
                              ? P.short
                              : P.slateLight,
                      },
                    ],
                  })
                }
              >
                <rect
                  x={x + 1}
                  y={y + 1}
                  width={cell - 2}
                  height={cell - 2}
                  rx="3"
                  fill={colorFor(value, diagonal)}
                />
                {cell >= 25 ? (
                  <text
                    x={x + cell / 2}
                    y={y + cell / 2 + 3}
                    fill={diagonal ? P.ink : rgba(P.ink.replace("var(--ink, ", "").replace(")", ""), 0.9)}
                    fontSize="10.5"
                    fontFamily={MONO}
                    textAnchor="middle"
                  >
                    {value.toFixed(cell < 34 ? 1 : decimals)}
                  </text>
                ) : null}
              </g>
            );
          }),
        )}
        <g transform={`translate(${(W - legendWidth) / 2} ${Math.min(H - 15, plotBottom + 20)})`}>
          {[-1, -0.5, 0, 0.5, 1].map((value, index) => (
            <g key={value} transform={`translate(${index * legendItemWidth} 0)`}>
              <rect
                width="14"
                height="8"
                rx="2"
                fill={colorFor(value, false)}
              />
              <text x="18" y="8" fill={P.muted2} fontSize="10.5">
                {value.toFixed(1)}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </ChartSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Liquidation heatmap                                                        */
/* -------------------------------------------------------------------------- */

export interface LiquidationEvent {
  id?: string;
  time: QuantTime;
  price: number;
  notional: number;
  side: "long" | "short";
  symbol?: string;
  venue?: string;
  leverage?: number;
}

export interface LiquidationHeatmapChartProps extends QuantVizBaseProps {
  events: LiquidationEvent[];
  currentPrice?: number;
  priceDecimals?: number;
  variant?: "liquidations" | "risk";
}

function eventTimeValue(value: QuantTime, fallback: number) {
  if (typeof value === "number" && finite(value)) return value;
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return finite(parsed) ? parsed : fallback;
}

export function LiquidationHeatmapChart({
  events,
  currentPrice,
  priceDecimals,
  variant = "liquidations",
  height = 330,
  className,
  emptyLabel,
}: LiquidationHeatmapChartProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const clean = events.filter(
    (event) =>
      finite(event.price) &&
      finite(event.notional) &&
      event.notional >= 0,
  );
  const H = Math.max(240, height);
  if (!clean.length) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "No liquidations in this window"}
        className={className}
      />
    );
  }
  const pad = { left: 58, right: 17, top: 22, bottom: 30 };
  const times = clean.map((event, index) =>
    eventTimeValue(event.time, index),
  );
  const [timeMin, timeMax] = extent(times, 0.015);
  const [priceMin, priceMax] = extent(
    clean.map((event) => event.price),
    0.05,
  );
  const xTime = linearScale(
    timeMin,
    timeMax,
    pad.left,
    VIEW_WIDTH - pad.right,
  );
  const yPrice = linearScale(priceMin, priceMax, H - pad.bottom, pad.top);
  const xBins = clamp(Math.ceil(Math.sqrt(clean.length) * 2), 8, 28);
  const yBins = 13;
  const binWidth = (VIEW_WIDTH - pad.left - pad.right) / xBins;
  const binHeight = (H - pad.top - pad.bottom) / yBins;
  const buckets = new Map<
    string,
    { x: number; y: number; total: number; longs: number; shorts: number }
  >();
  clean.forEach((event, index) => {
    const xRatio = clamp(
      (times[index] - timeMin) / Math.max(1e-9, timeMax - timeMin),
      0,
      0.99999,
    );
    const yRatio = clamp(
      (priceMax - event.price) / Math.max(1e-9, priceMax - priceMin),
      0,
      0.99999,
    );
    const x = Math.floor(xRatio * xBins);
    const y = Math.floor(yRatio * yBins);
    const key = `${x}:${y}`;
    const bucket = buckets.get(key) ?? {
      x,
      y,
      total: 0,
      longs: 0,
      shorts: 0,
    };
    bucket.total += event.notional;
    if (event.side === "long") bucket.longs += event.notional;
    else bucket.shorts += event.notional;
    buckets.set(key, bucket);
  });
  const maxBucket = Math.max(1, ...[...buckets.values()].map((b) => b.total));
  const maxEvent = Math.max(1, ...clean.map((event) => event.notional));

  return (
    <ChartSurface
      height={H}
      viewWidth={VIEW_WIDTH}
      viewHeight={H}
      label={variant === "risk" ? "Estimated liquidation risk concentration heatmap" : "Liquidation concentration heatmap"}
      className={className}
      tip={tip}
    >
      <div
        style={{
          position: "absolute",
          top: 7,
          left: 12,
          display: "flex",
          gap: 12,
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <LegendMark color={P.short} label={variant === "risk" ? "Long at risk" : "Long liquidated"} kind="box" />
        <LegendMark color={P.long} label={variant === "risk" ? "Short at risk" : "Short liquidated"} kind="box" />
      </div>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_WIDTH} ${H}`}
        preserveAspectRatio="none"
        onMouseLeave={() => setTip(null)}
        style={{ display: "block", fontFamily: FONT }}
      >
        {ticks(priceMin, priceMax, 5).map((price) => {
          const y = yPrice(price);
          return (
            <g key={price}>
              <line
                x1={pad.left}
                x2={VIEW_WIDTH - pad.right}
                y1={y}
                y2={y}
                stroke={P.grid}
                strokeDasharray="2 5"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={pad.left - 8}
                y={y + 3}
                fill={P.muted2}
                fontSize="9"
                textAnchor="end"
              >
                {priceLabel(price, priceDecimals)}
              </text>
            </g>
          );
        })}
        {[...buckets.values()].map((bucket) => {
          const color =
            bucket.longs >= bucket.shorts ? P.short : P.long;
          const opacity =
            0.05 + Math.sqrt(bucket.total / maxBucket) * 0.48;
          return (
            <rect
              key={`${bucket.x}-${bucket.y}`}
              x={pad.left + bucket.x * binWidth + 0.6}
              y={pad.top + bucket.y * binHeight + 0.6}
              width={Math.max(0.5, binWidth - 1.2)}
              height={Math.max(0.5, binHeight - 1.2)}
              rx="1.5"
              fill={rgba(color, opacity)}
              onMouseEnter={() =>
                setTip({
                  x: pad.left + (bucket.x + 0.5) * binWidth,
                  y: pad.top + (bucket.y + 0.5) * binHeight,
                  title: variant === "risk" ? "Estimated risk cluster" : "Liquidation cluster",
                  rows: [
                    { label: variant === "risk" ? "Notional at risk" : "Total", value: money(bucket.total), color },
                    { label: "Longs", value: money(bucket.longs), color: P.short },
                    { label: "Shorts", value: money(bucket.shorts), color: P.long },
                  ],
                })
              }
            />
          );
        })}
        {clean.length <= 160
          ? clean.map((event, index) => {
              const color = event.side === "long" ? P.short : P.long;
              const x = xTime(times[index]);
              const y = yPrice(event.price);
              const radius =
                1.5 + Math.sqrt(event.notional / maxEvent) * 5.5;
              return (
                <circle
                  key={event.id ?? `${String(event.time)}-${index}`}
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={rgba(color, 0.68)}
                  stroke="var(--bg-2, #101215)"
                  strokeWidth=".6"
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() =>
                    setTip({
                      x,
                      y,
                      title: `${event.symbol ?? "Market"} · ${timeLabel(event.time)}`,
                      rows: [
                        {
                          label: variant === "risk" ? "Position side" : "Liquidated",
                          value: event.side === "long" ? "LONG" : "SHORT",
                          color,
                        },
                        { label: "Notional", value: money(event.notional), color },
                        { label: "Price", value: priceLabel(event.price, priceDecimals) },
                        ...(event.leverage !== undefined
                          ? [{ label: "Leverage", value: `${event.leverage.toFixed(1)}×` }]
                          : []),
                        ...(event.venue
                          ? [{ label: "Venue", value: event.venue }]
                          : []),
                      ],
                    })
                  }
                />
              );
            })
          : null}
        {currentPrice !== undefined &&
        currentPrice >= priceMin &&
        currentPrice <= priceMax ? (
          <line
            x1={pad.left}
            x2={VIEW_WIDTH - pad.right}
            y1={yPrice(currentPrice)}
            y2={yPrice(currentPrice)}
            stroke={P.accent}
            strokeWidth="1"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {sampleIndices(clean.length, 5).map((index) => (
          <text
            key={index}
            x={xTime(times[index])}
            y={H - 10}
            fill={P.muted2}
            fontSize="9"
            textAnchor="middle"
          >
            {shortTimeLabel(clean[index].time)}
          </text>
        ))}
      </svg>
    </ChartSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Carry opportunity ladder                                                   */
/* -------------------------------------------------------------------------- */

export type CarryRisk = "low" | "medium" | "high" | number;

export interface CarryOpportunity {
  market: string;
  longVenue: string;
  shortVenue: string;
  longFundingPct: number;
  shortFundingPct: number;
  netAprPct: number;
  capacityUsd: number;
  risk: CarryRisk;
}

export interface CarryOpportunityLadderProps {
  items: CarryOpportunity[];
  className?: string;
  emptyLabel?: string;
  maxRows?: number;
  onSelect?: (item: CarryOpportunity) => void;
}

function riskPresentation(risk: CarryRisk) {
  if (typeof risk === "number") {
    const value = clamp(risk, 0, 100);
    return {
      label: `${value.toFixed(0)}/100`,
      color: value < 34 ? P.long : value < 67 ? P.warning : P.short,
    };
  }
  return {
    label: risk.toUpperCase(),
    color: risk === "low" ? P.long : risk === "medium" ? P.warning : P.short,
  };
}

export function CarryOpportunityLadder({
  items,
  className,
  emptyLabel,
  maxRows = 10,
  onSelect,
}: CarryOpportunityLadderProps) {
  const clean = items
    .filter(
      (item) =>
        item.market &&
        finite(item.netAprPct) &&
        finite(item.capacityUsd),
    )
    .sort((a, b) => b.netAprPct - a.netAprPct)
    .slice(0, Math.max(1, maxRows));
  if (!clean.length) {
    return (
      <QuantVizEmptyState
        height={220}
        label={emptyLabel ?? "No positive carry routes"}
        className={className}
      />
    );
  }
  const maxApr = Math.max(1, ...clean.map((item) => Math.abs(item.netAprPct)));
  const headerCell: CSSProperties = {
    padding: "9px 12px",
    color: P.muted2,
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: ".1em",
    textTransform: "uppercase",
    textAlign: "left",
    whiteSpace: "nowrap",
    borderBottom: "1px solid var(--hair, rgba(255,255,255,.07))",
  };
  const bodyCell: CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid var(--hair-soft, rgba(255,255,255,.04))",
    fontSize: 11,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div
      className={className}
      style={{ ...shellStyle, overflowX: "auto" }}
    >
      <table
        aria-label="Carry opportunities ranked by net annualized return"
        style={{
          width: "100%",
          minWidth: 760,
          borderCollapse: "collapse",
          fontFamily: FONT,
        }}
      >
        <thead>
          <tr>
            <th style={{ ...headerCell, width: 42 }}>#</th>
            <th style={headerCell}>Market</th>
            <th style={headerCell}>Hedge route</th>
            <th style={headerCell}>Funding legs</th>
            <th style={{ ...headerCell, minWidth: 150 }}>Net APR</th>
            <th style={headerCell}>Capacity</th>
            <th style={headerCell}>Risk</th>
          </tr>
        </thead>
        <tbody>
          {clean.map((item, index) => {
            const risk = riskPresentation(item.risk);
            const positive = item.netAprPct >= 0;
            const color = positive ? P.long : P.short;
            return (
              <tr
                key={`${item.market}-${item.longVenue}-${item.shortVenue}`}
                title={`${item.market}: long ${item.longVenue}, short ${item.shortVenue}; ${percentage(item.netAprPct, 2)} net APR`}
                onClick={() => onSelect?.(item)}
                style={{
                  cursor: onSelect ? "pointer" : "default",
                  background: index === 0 ? rgba(P.long, 0.035) : undefined,
                }}
              >
                <td style={{ ...bodyCell, color: P.muted2 }}>
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td style={{ ...bodyCell, color: P.ink, fontWeight: 700 }}>
                  {item.market}
                </td>
                <td style={bodyCell}>
                  <span style={{ color: P.long }}>{item.longVenue}</span>
                  <span style={{ color: P.muted2, padding: "0 7px" }}>→</span>
                  <span style={{ color: P.short }}>{item.shortVenue}</span>
                </td>
                <td style={{ ...bodyCell, fontFamily: MONO }}>
                  <span style={{ color: P.long }}>
                    {percentage(item.longFundingPct, 3)}
                  </span>
                  <span style={{ color: P.muted2, padding: "0 5px" }}>/</span>
                  <span style={{ color: P.short }}>
                    {percentage(item.shortFundingPct, 3)}
                  </span>
                </td>
                <td style={bodyCell}>
                  <div
                    style={{
                      position: "relative",
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 5,
                        width: `${(Math.abs(item.netAprPct) / maxApr) * 100}%`,
                        height: 8,
                        borderRadius: 2,
                        background: rgba(color, 0.18),
                      }}
                    />
                    <span
                      style={{
                        position: "relative",
                        color,
                        fontFamily: MONO,
                        fontWeight: 700,
                      }}
                    >
                      {percentage(item.netAprPct, 2)}
                    </span>
                  </div>
                </td>
                <td style={{ ...bodyCell, color: P.ink }}>
                  {money(item.capacityUsd)}
                </td>
                <td style={bodyCell}>
                  <span
                    style={{
                      display: "inline-flex",
                      padding: "3px 7px",
                      borderRadius: 5,
                      color: risk.color,
                      border: `1px solid ${rgba(risk.color, 0.28)}`,
                      background: rgba(risk.color, 0.07),
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: ".05em",
                    }}
                  >
                    {risk.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Long / short leverage distribution                                         */
/* -------------------------------------------------------------------------- */

export interface LeverageBucket {
  label: string;
  long: number;
  short: number;
}

export interface LeverageDistributionChartProps extends QuantVizBaseProps {
  buckets: LeverageBucket[];
  valueMode?: "positions" | "notional";
}

export function LeverageDistributionChart({
  buckets,
  valueMode = "positions",
  height = 310,
  className,
  emptyLabel,
}: LeverageDistributionChartProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const clean = buckets.filter(
    (bucket) =>
      bucket.label && finite(bucket.long) && finite(bucket.short),
  );
  const rowGap = 6;
  // Preserve the caller's requested height while retaining a full-row touch
  // target for every bucket. Five standard buckets fit compactly at 310px.
  const H = Math.max(
    250,
    height,
    52 + clean.length * 44 + Math.max(0, clean.length - 1) * rowGap,
  );
  if (!clean.length) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "No leverage distribution"}
        className={className}
      />
    );
  }
  const maxTotal = Math.max(
    1,
    ...clean.map(
      (bucket) => Math.max(0, bucket.long) + Math.max(0, bucket.short),
    ),
  );
  const formatValue = (value: number) =>
    valueMode === "notional" ? money(value) : compact(value);
  const displayValue = (value: number) =>
    value > 0 ? formatValue(value) : "\u2014";
  const badgeColumn = "clamp(52px, 12vw, 74px)";
  const bodyHeight = H - 52;
  const rowHeight =
    (bodyHeight - Math.max(0, clean.length - 1) * rowGap) / clean.length;
  const riskColors = [P.slate, P.slateLight, P.warning, "#df8d62", P.short];

  const showTip = (bucket: LeverageBucket, index: number) => {
    const shortValue = Math.max(0, bucket.short);
    const longValue = Math.max(0, bucket.long);
    const total = shortValue + longValue;
    setActiveBucket(bucket.label);
    setTip({
      x: 76,
      y: 42 + index * (rowHeight + rowGap) + rowHeight / 2,
      title: `${bucket.label} leverage`,
      rows: [
        {
          label: "Short",
          value: displayValue(shortValue),
          color: P.short,
        },
        {
          label: "Total",
          value: displayValue(total),
        },
        {
          label: "Long",
          value: displayValue(longValue),
          color: P.long,
        },
        {
          label: "Short / long",
          value:
            total > 0
              ? `${percentage((shortValue / total) * 100, 1, false)} / ${percentage(
                  (longValue / total) * 100,
                  1,
                  false,
                )}`
              : "\u2014",
        },
      ],
    });
  };

  const clearTip = () => {
    setTip(null);
    setActiveBucket(null);
  };

  return (
    <div
      className={className}
      role="group"
      aria-label={`Long and short leverage distribution by ${
        valueMode === "notional" ? "notional value" : "position count"
      }`}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") clearTip();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          clearTip();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          clearTip();
        }
      }}
      style={{
        ...shellStyle,
        height: H,
        padding: "10px clamp(8px, 2vw, 14px)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          display: "grid",
          gridTemplateColumns: `${badgeColumn} minmax(0, 1fr)`,
          columnGap: 10,
          alignItems: "center",
          height: 32,
          padding: "0 8px",
          color: P.muted,
          fontFamily: FONT,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".09em",
        }}
      >
        <span
          style={{
            color: P.muted2,
            textAlign: "center",
            fontSize: 9.5,
            letterSpacing: ".06em",
          }}
        >
          LEVERAGE
        </span>
        <span
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            alignItems: "center",
          }}
        >
          <span style={{ color: P.short, textAlign: "left" }}>SHORT</span>
          <span style={{ color: P.muted2, textAlign: "center" }}>TOTAL</span>
          <span style={{ color: P.long, textAlign: "right" }}>LONG</span>
        </span>
      </div>

      <div
        style={{
          height: bodyHeight,
          display: "flex",
          flexDirection: "column",
          gap: rowGap,
        }}
      >
        {clean.map((bucket, index) => {
          const shortValue = Math.max(0, bucket.short);
          const longValue = Math.max(0, bucket.long);
          const total = shortValue + longValue;
          const totalRatio = (total / maxTotal) * 100;
          const shortShare = total > 0 ? (shortValue / total) * 100 : 0;
          const longShare = total > 0 ? (longValue / total) * 100 : 0;
          const active = activeBucket === bucket.label;
          const riskColor =
            riskColors[
              Math.min(
                riskColors.length - 1,
                Math.round(
                  (index / Math.max(1, clean.length - 1)) *
                    (riskColors.length - 1),
                ),
              )
            ];
          const ariaLabel = `${bucket.label} leverage: Short ${displayValue(
            shortValue,
          )}, total ${displayValue(total)}, long ${displayValue(longValue)}`;
          return (
            <button
              key={bucket.label}
              type="button"
              aria-label={ariaLabel}
              onPointerEnter={() => showTip(bucket, index)}
              onFocus={() => showTip(bucket, index)}
              onClick={() => showTip(bucket, index)}
              style={{
                display: "grid",
                gridTemplateColumns: `${badgeColumn} minmax(0, 1fr)`,
                columnGap: 10,
                alignItems: "center",
                flex: "1 1 0",
                minHeight: 44,
                minWidth: 0,
                width: "100%",
                padding: "5px 8px",
                border: `1px solid ${
                  active
                    ? rgba(riskColor, 0.5)
                    : "var(--hair, rgba(255,255,255,.07))"
                }`,
                borderRadius: 7,
                outline: active ? `1px solid ${rgba(riskColor, 0.16)}` : "none",
                outlineOffset: 1,
                background: active
                  ? `linear-gradient(90deg, ${rgba(riskColor, 0.09)}, ${rgba(
                      riskColor,
                      0.025,
                    )})`
                  : "rgba(127,145,160,.025)",
                color: P.ink,
                cursor: "pointer",
                touchAction: "manipulation",
                fontFamily: FONT,
                textAlign: "left",
              }}
            >
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  minWidth: 0,
                  height: 28,
                  padding: "0 6px",
                  border: `1px solid ${rgba(riskColor, active ? 0.5 : 0.25)}`,
                  borderRadius: 6,
                  background: rgba(riskColor, active ? 0.13 : 0.07),
                  color: P.ink,
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {bucket.label}
              </span>

              <span
                style={{
                  display: "grid",
                  gridTemplateRows: "auto 7px",
                  rowGap: 5,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    alignItems: "center",
                    minWidth: 0,
                    fontFamily: MONO,
                    fontSize: "clamp(9px, 1.1vw, 11px)",
                    fontWeight: 700,
                    lineHeight: 1.1,
                  }}
                >
                  <span
                    style={{
                      minWidth: 0,
                      overflow: "hidden",
                      color: shortValue > 0 ? P.short : P.muted2,
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayValue(shortValue)}
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      overflow: "hidden",
                      color: total > 0 ? P.ink : P.muted2,
                      textAlign: "center",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayValue(total)}
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      overflow: "hidden",
                      color: longValue > 0 ? P.long : P.muted2,
                      textAlign: "right",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayValue(longValue)}
                  </span>
                </span>

                <span
                  aria-hidden="true"
                  style={{
                    position: "relative",
                    display: "block",
                    height: 7,
                    minWidth: 0,
                    overflow: "hidden",
                    borderRadius: 999,
                    background: "rgba(127,145,160,.095)",
                  }}
                >
                  {total > 0 ? (
                    <span
                      style={{
                        display: "flex",
                        width: `max(4px, ${totalRatio}%)`,
                        height: "100%",
                        overflow: "hidden",
                        borderRadius: 999,
                      }}
                    >
                      {shortValue > 0 ? (
                        <span
                          style={{
                            width: `${shortShare}%`,
                            minWidth: shortShare > 0 ? 2 : 0,
                            background: P.short,
                          }}
                        />
                      ) : null}
                      {longValue > 0 ? (
                        <span
                          style={{
                            width: `${longShare}%`,
                            minWidth: longShare > 0 ? 2 : 0,
                            background: P.long,
                          }}
                        />
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {tip ? <PlotTooltip tip={tip} viewWidth={100} viewHeight={H} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Venue bubbles                                                              */
/* -------------------------------------------------------------------------- */

export interface VenueBubble {
  venue: string;
  volume: number;
  openInterest: number;
  spreadBps: number;
  fundingRatePct?: number;
  uptimePct?: number;
}

export interface VenueBubbleChartProps extends QuantVizBaseProps {
  venues: VenueBubble[];
  xLabel?: string;
  xValueLabel?: string;
  fundingLabel?: string;
}

export function VenueBubbleChart({
  venues,
  xLabel = "SPREAD (BPS)",
  xValueLabel = "Spread",
  fundingLabel = "Funding",
  height = 330,
  className,
  emptyLabel,
}: VenueBubbleChartProps) {
  const [tip, setTip] = useState<PlotTip | null>(null);
  const clean = venues.filter(
    (venue) =>
      venue.venue &&
      finite(venue.volume) &&
      finite(venue.openInterest) &&
      finite(venue.spreadBps),
  );
  const H = Math.max(240, height);
  if (!clean.length) {
    return (
      <QuantVizEmptyState
        height={height}
        label={emptyLabel ?? "No venue comparison data"}
        className={className}
      />
    );
  }
  const W = 720;
  const pad = { left: 58, right: 22, top: 28, bottom: 34 };
  const [spreadMinRaw, spreadMax] = extent(
    clean.map((venue) => venue.spreadBps),
    0.08,
  );
  const spreadMin = Math.max(0, spreadMinRaw);
  const logVolumes = clean.map((venue) =>
    Math.log10(Math.max(1, venue.volume)),
  );
  const [logMin, logMax] = extent(logVolumes, 0.08);
  const maxOi = Math.max(1, ...clean.map((venue) => venue.openInterest));
  const xSpread = linearScale(
    spreadMin,
    spreadMax,
    pad.left,
    W - pad.right,
  );
  const yVolume = linearScale(logMin, logMax, H - pad.bottom, pad.top);
  const radius = (oi: number) =>
    7 + Math.sqrt(Math.max(0, oi) / maxOi) * 27;

  return (
    <ChartSurface
      height={H}
      viewWidth={W}
      viewHeight={H}
      label={`Trading venue volume, ${xValueLabel.toLowerCase()} and open interest bubbles`}
      className={className}
      tip={tip}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseLeave={() => setTip(null)}
        style={{ display: "block", fontFamily: FONT }}
      >
        {ticks(logMin, logMax, 4).map((value) => {
          const y = yVolume(value);
          return (
            <g key={value}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
                stroke={P.grid}
                strokeDasharray="2 5"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={pad.left - 8}
                y={y + 3}
                fill={P.muted2}
                fontSize="9"
                textAnchor="end"
              >
                {money(10 ** value)}
              </text>
            </g>
          );
        })}
        {ticks(spreadMin, spreadMax, 5).map((value) => (
          <g key={value}>
            <line
              x1={xSpread(value)}
              x2={xSpread(value)}
              y1={pad.top}
              y2={H - pad.bottom}
              stroke={P.grid}
              strokeDasharray="2 5"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={xSpread(value)}
              y={H - 12}
              fill={P.muted2}
              fontSize="9"
              textAnchor="middle"
            >
              {value.toFixed(1)}
            </text>
          </g>
        ))}
        <text
          x={W - pad.right}
          y={H - 3}
          fill={P.muted2}
          fontSize="8"
          textAnchor="end"
          letterSpacing=".08em"
        >
          {xLabel.toUpperCase()}
        </text>
        {clean
          .slice()
          .sort((a, b) => b.openInterest - a.openInterest)
          .map((venue, index) => {
            const x = xSpread(venue.spreadBps);
            const y = yVolume(Math.log10(Math.max(1, venue.volume)));
            const r = radius(venue.openInterest);
            const rate = venue.fundingRatePct ?? 0;
            const color =
              venue.fundingRatePct === undefined
                ? P.slateLight
                : rate >= 0
                  ? P.long
                  : P.short;
            return (
              <g
                key={venue.venue}
                onMouseEnter={() =>
                  setTip({
                    x,
                    y,
                    title: venue.venue,
                    rows: [
                      { label: "24h volume", value: money(venue.volume) },
                      { label: "Open interest", value: money(venue.openInterest) },
                      { label: xValueLabel, value: `${venue.spreadBps.toFixed(2)} bps` },
                      ...(venue.fundingRatePct !== undefined
                        ? [
                            {
                              label: fundingLabel,
                              value: percentage(venue.fundingRatePct, 4),
                              color,
                            },
                          ]
                        : []),
                      ...(venue.uptimePct !== undefined
                        ? [
                            {
                              label: "Uptime",
                              value: percentage(venue.uptimePct, 2, false),
                            },
                          ]
                        : []),
                    ],
                  })
                }
              >
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={rgba(color, 0.16 + Math.min(index, 3) * 0.025)}
                  stroke={rgba(color, 0.75)}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={x}
                  y={y + 3}
                  fill={P.ink}
                  fontSize={clamp(r / 3, 8, 11)}
                  fontWeight="650"
                  textAnchor="middle"
                >
                  {venue.venue.length > 10
                    ? venue.venue.slice(0, 9)
                    : venue.venue}
                </text>
              </g>
            );
          })}
      </svg>
    </ChartSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Liquidation feed                                                           */
/* -------------------------------------------------------------------------- */

export interface LiquidationFeedVisualProps {
  events: LiquidationEvent[];
  maxItems?: number;
  className?: string;
  emptyLabel?: string;
  priceDecimals?: number;
  variant?: "liquidations" | "risk";
}

export function LiquidationFeedVisual({
  events,
  maxItems = 8,
  className,
  emptyLabel,
  priceDecimals,
  variant = "liquidations",
}: LiquidationFeedVisualProps) {
  const clean = events
    .filter(
      (event) =>
        finite(event.price) &&
        finite(event.notional) &&
        event.notional >= 0,
    )
    .slice(0, Math.max(1, maxItems));
  if (!clean.length) {
    return (
      <QuantVizEmptyState
        height={210}
        label={emptyLabel ?? "Liquidation tape is quiet"}
        className={className}
      />
    );
  }
  const maxNotional = Math.max(1, ...clean.map((event) => event.notional));

  return (
    <div
      className={className}
      aria-label={variant === "risk" ? "Estimated liquidation risk feed" : "Recent liquidation feed"}
      style={{ ...shellStyle, fontFamily: FONT }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "72px minmax(92px, 1fr) 80px 92px 70px",
          gap: 10,
          padding: "9px 12px",
          borderBottom: "1px solid var(--hair, rgba(255,255,255,.07))",
          color: P.muted2,
          fontSize: 8.5,
          fontWeight: 650,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          minWidth: 520,
        }}
      >
        <span>Time</span>
        <span>Market / Venue</span>
        <span>Side</span>
        <span style={{ textAlign: "right" }}>Notional</span>
        <span style={{ textAlign: "right" }}>Price</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 520 }}>
          {clean.map((event, index) => {
            const color = event.side === "long" ? P.short : P.long;
            const width =
              Math.sqrt(event.notional / maxNotional) * 100;
            return (
              <div
                key={event.id ?? `${String(event.time)}-${index}`}
                title={`${event.side === "long" ? "Long" : "Short"} ${variant === "risk" ? "position at risk" : "liquidation"}: ${money(event.notional)} at ${priceLabel(event.price, priceDecimals)}`}
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "72px minmax(92px, 1fr) 80px 92px 70px",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 43,
                  padding: "8px 12px",
                  borderBottom:
                    index === clean.length - 1
                      ? "none"
                      : "1px solid var(--hair-soft, rgba(255,255,255,.04))",
                  fontSize: 10.5,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    width: `${width}%`,
                    height: 1,
                    background: rgba(color, 0.62),
                  }}
                />
                <span style={{ color: P.muted, fontFamily: MONO }}>
                  {shortTimeLabel(event.time)}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: P.ink,
                    fontWeight: 650,
                  }}
                >
                  {event.symbol ?? "—"}
                  {event.venue ? (
                    <small
                      style={{
                        marginLeft: 6,
                        color: P.muted2,
                        fontSize: 8.5,
                      }}
                    >
                      {event.venue}
                    </small>
                  ) : null}
                </span>
                <span
                  style={{
                    color,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: ".05em",
                  }}
                >
                  {variant === "risk"
                    ? event.side === "long" ? "LONG RISK" : "SHORT RISK"
                    : event.side === "long" ? "LONG LIQ" : "SHORT LIQ"}
                </span>
                <span
                  style={{
                    color,
                    textAlign: "right",
                    fontFamily: MONO,
                    fontWeight: 650,
                  }}
                >
                  {money(event.notional)}
                </span>
                <span
                  style={{
                    color: P.ink,
                    textAlign: "right",
                    fontFamily: MONO,
                  }}
                >
                  {priceLabel(event.price, priceDecimals)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
