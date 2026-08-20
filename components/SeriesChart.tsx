"use client";

import { useState, type ReactNode } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Cell, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { usd } from "@/lib/format";
import ChartCard from "@/components/ChartCard";

const DEFAULT_GROUPS = ["BTC", "ETH", "SOL", "HYPE", "Others"];
const COLORS: Record<string, string> = {
  BTC: "#f7931a", ETH: "#8aa0c8", SOL: "#14f195", HYPE: "#2ee6b6",
  RWA: "#e6c069", Commodities: "#e6c069", Stocks: "#5fa8ff",
  XAU: "#e6c069", XAG: "#c9d1d9", CL: "#d98a4a", BZ: "#b06b3a",
  SNDK: "#e0685f", SPCX: "#7ea6e0", MU: "#4fb3c9", DRAM: "#9d8ce0",
  INTC: "#6fb98f", QQQ: "#b8c95f", SPY: "#d98cb3",
  Others: "#7d8996",
};

type Pt = { t: number; est?: boolean } & Record<string, number | boolean | undefined>;

export default function SeriesChart({
  title,
  subtitle,
  points,
  mode,
  extraKey,
  extraLabel,
  groups = DEFAULT_GROUPS,
  toolbar,
}: {
  title: string;
  subtitle?: string;
  points: Pt[];
  mode: "bars" | "lines";
  extraKey: "total" | "cum";
  extraLabel: string;
  groups?: string[];
  toolbar?: ReactNode;
}) {
  const COINS = groups;
  // precompute total + cumulative
  let run = 0;
  const data = points.map((p) => {
    const total = COINS.reduce((s, c) => s + (Number(p[c]) || 0), 0);
    run += total;
    return { ...p, total, cum: run };
  });
  // Snapshot-rebuilt days stay visible as estimates instead of being presented
  // as measured Dune buckets. Bars are dimmed and tooltips carry an `est.` tag.
  const estDays = new Set(points.filter((p) => p.est).map((p) => p.t));

  const allKeys = [...COINS, extraKey];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setHidden((h) => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const visible = (k: string) => !hidden.has(k);
  const allOff = allKeys.every((k) => hidden.has(k));

  const xFmt = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  const EXTRA_COLOR = "#6f8bff";
  const TICK = "#96a3b2";
  const AXIS = "rgba(255,255,255,0.15)";
  const colorOf = (key: string) => COLORS[key] ?? "#8b98a8";

  const toggles = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
      {COINS.map((c) => (
        <Chip key={c} label={c} color={colorOf(c)} on={visible(c)} onClick={() => toggle(c)} />
      ))}
      <Chip label={extraLabel} color={EXTRA_COLOR} on={visible(extraKey)} onClick={() => toggle(extraKey)} />
      <button type="button" className="chip" onClick={() => setHidden(allOff ? new Set() : new Set(allKeys))} style={{ cursor: "pointer" }}>
        {allOff ? "Select all" : "Deselect all"}
      </button>
      {estDays.size > 0 && (
        <span style={{ color: "var(--muted)", fontSize: 11, alignSelf: "center", lineHeight: 1.4 }}>
          ◌ {estDays.size} estimated day{estDays.size === 1 ? "" : "s"} from live snapshots
        </span>
      )}
    </div>
  );

  return (
    <ChartCard title={title} subtitle={subtitle} height={300} modalHeight={460} controls={toggles} toolbar={toolbar} filename={`risescreener-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      {data.length < 2 ? (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>
          Builds from periodic snapshots.<br />
          RISEx has no historical API — this fills in as the timeseries cron runs.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 10, left: 6, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 5" vertical={false} />
            <XAxis dataKey="t" tickFormatter={xFmt} tick={{ fill: TICK, fontSize: 11, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} minTickGap={44} />
            <YAxis yAxisId="l" tick={{ fill: TICK, fontSize: 11, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} axisLine={false} width={58} tickFormatter={(v) => usd(Number(v))} />
            <YAxis yAxisId="r" orientation="right" tick={{ fill: TICK, fontSize: 11, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} axisLine={false} width={58} tickFormatter={(v) => usd(Number(v))} />
            <Tooltip
              contentStyle={{ background: "rgba(10,14,20,0.98)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, fontSize: 11.5, padding: "8px 11px", fontFamily: "var(--font)" }}
              labelStyle={{ color: "#aab5c2", marginBottom: 4, fontSize: 11 }}
              itemStyle={{ color: "#e7edf3" }}
              cursor={{ stroke: "rgba(255,255,255,0.14)", strokeWidth: 1 }}
              labelFormatter={(t) => `${xFmt(Number(t))}${estDays.has(Number(t)) ? " · est." : ""}`}
              formatter={(v: number, name: string) => [usd(Number(v)), name]}
            />
            {COINS.filter(visible).map((c) =>
              mode === "bars" ? (
                <Bar key={c} yAxisId="l" dataKey={c} stackId="s" fill={colorOf(c)} isAnimationActive={false}>
                  {data.map((point, index) => <Cell key={`${c}-${index}`} fill={colorOf(c)} fillOpacity={point.est ? 0.58 : 0.9} />)}
                </Bar>
              ) : (
                <Line key={c} yAxisId="l" type="monotone" dataKey={c} stroke={colorOf(c)} strokeWidth={1.8} dot={false} isAnimationActive={false} />
              ),
            )}
            {visible(extraKey) && (
              <Line yAxisId="r" type="monotone" dataKey={extraKey} name={extraLabel} stroke={EXTRA_COLOR} strokeWidth={1.8} dot={false} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function Chip({ label, color, on, onClick }: { label: string; color: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="chip"
      style={{ cursor: "pointer", opacity: on ? 1 : 0.4, borderColor: on ? color : "var(--hair)" }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: "inline-block" }} />
      {label}
    </button>
  );
}
