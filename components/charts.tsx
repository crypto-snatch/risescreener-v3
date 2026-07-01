"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  Treemap,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { usd } from "@/lib/format";

/* ── shared chart theme (V3) ──────────────────────────────────
   Minimal chrome: no vertical grid, faint dashed horizontal only,
   thin strokes, muted tabular ticks, one clean rounded tooltip. */
const ACC = "#2ee6b6";
const ACC2 = "#6f8bff";
const LONG = "#3fdd9a";
const SHORT = "#ff6b7d";
const WARN = "#f5c451";
const GRID = "rgba(255,255,255,0.05)";
const AXIS = "rgba(255,255,255,0.10)";
const TICK = "#647588";

const AXIS_TICK = { fill: TICK, fontSize: 10, fontFamily: "var(--font)" } as const;

const tip = {
  contentStyle: {
    background: "rgba(10,14,20,0.94)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 10,
    fontSize: 11.5,
    padding: "8px 11px",
    boxShadow: "0 12px 30px -14px rgba(0,0,0,0.7)",
    fontFamily: "var(--font)",
  },
  labelStyle: { color: "#8b9bad", marginBottom: 4, fontSize: 10.5, letterSpacing: "0.04em" },
  itemStyle: { color: "#e7edf3" },
  cursor: { stroke: "rgba(255,255,255,0.14)", strokeWidth: 1 },
} as const;

const grid = <CartesianGrid stroke={GRID} strokeDasharray="2 5" vertical={false} />;

export function Spark({ data, color = ACC, height = 40 }: { data: number[]; color?: string; height?: number }) {
  const d = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={d}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AreaTrend({
  data,
  xKey = "t",
  yKey = "v",
  color = ACC,
  height = 240,
  xPreset = "date",
  yPreset = "raw",
  valueName = "value",
}: {
  data: Record<string, number>[];
  xKey?: string;
  yKey?: string;
  color?: string;
  height?: number | string;
  xPreset?: "date" | "datetime";
  yPreset?: "raw" | "usd";
  valueName?: string;
}) {
  // formatting stays client-side (functions can't cross the server→client boundary)
  const xFmt = (t: number) =>
    xPreset === "datetime"
      ? new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", timeZone: "UTC" })
      : new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  const yFmt = (v: number) => (yPreset === "usd" ? usd(Number(v)) : String(v));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 10, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.26} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid}
        <XAxis dataKey={xKey} tick={AXIS_TICK} tickFormatter={xFmt} stroke={AXIS} tickLine={false} minTickGap={40} />
        <YAxis tick={AXIS_TICK} stroke={AXIS} tickLine={false} axisLine={false} width={yPreset === "usd" ? 56 : 46} tickFormatter={yFmt} />
        <Tooltip {...tip} labelFormatter={(t) => xFmt(Number(t))} formatter={(v: number) => [yFmt(Number(v)), valueName]} />
        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={1.75} fill={`url(#g-${yKey})`} isAnimationActive={false} activeDot={{ r: 3, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars({
  data,
  xKey = "label",
  yKey = "v",
  color = ACC,
  height = 220,
  colorBySign,
}: {
  data: Record<string, number | string>[];
  xKey?: string;
  yKey?: string;
  color?: string;
  height?: number;
  colorBySign?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 10, left: 6, bottom: 0 }}>
        {grid}
        <XAxis dataKey={xKey} tick={AXIS_TICK} stroke={AXIS} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
        <YAxis tick={AXIS_TICK} stroke={AXIS} tickLine={false} axisLine={false} width={46} />
        <Tooltip {...tip} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
        <Bar dataKey={yKey} radius={[3, 3, 0, 0]} maxBarSize={34} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorBySign ? (Number(d[yKey]) >= 0 ? LONG : SHORT) : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function sliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) {
  if (percent < 0.06) return null; // hide tiny slices to avoid clutter
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily="var(--font)" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,0.45)" strokeWidth={2.6} fill="#fff">
      <tspan fontSize={11} fontWeight={700}>{name}</tspan>
      <tspan x={x} dy={13} fontSize={10} fontWeight={600} fillOpacity={0.85}>{(percent * 100).toFixed(0)}%</tspan>
    </text>
  );
}

export function Donut({ data, height = 200, labels = true }: { data: { name: string; value: number; color: string }[]; height?: number | string; labels?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={1}
          strokeWidth={0} isAnimationActive={false} label={labels ? sliceLabel : undefined} labelLine={false}
          onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} stroke="transparent" fillOpacity={active === null || active === i ? 1 : 0.28} style={{ outline: "none" }} />
          ))}
        </Pie>
        <Tooltip {...tip} formatter={(v: number, n: string) => [usd(Number(v)), n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// 0–100 gauge (e.g. OI utilization)
export function Gauge({ value, height = 90, color }: { value: number; height?: number; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const c = color ?? (v > 85 ? SHORT : v > 60 ? WARN : ACC);
  const data = [{ name: "v", value: v, fill: c }];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
        <RadialBar background={{ fill: "rgba(255,255,255,0.05)" }} dataKey="value" cornerRadius={6} isAnimationActive={false} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

export function TreemapChart({ data, height = 360 }: { data: { name: string; size: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap data={data} dataKey="size" stroke="var(--bg)" fill={ACC} isAnimationActive={false} aspectRatio={4 / 3} />
    </ResponsiveContainer>
  );
}

// colored grouped bars (e.g. current OI by market) with $ axis
export function GroupBars({ data, height = 300 }: { data: { label: string; v: number; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 10, left: 6, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} interval={0} />
        <YAxis tick={AXIS_TICK} stroke={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => usd(Number(v))} />
        <Tooltip {...tip} cursor={{ fill: "rgba(255,255,255,0.05)" }} formatter={(v: number) => [usd(Number(v)), "OI"]} />
        <Bar dataKey="v" radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const CHART_COLORS = { ACC, ACC2, LONG, SHORT, WARN };
