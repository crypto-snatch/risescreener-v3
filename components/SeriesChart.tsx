"use client";

import { useState, type ReactNode } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { usd } from "@/lib/format";
import ChartCard from "@/components/ChartCard";

const DEFAULT_GROUPS = ["BTC", "ETH", "SOL", "HYPE", "Others"];
const COLORS: Record<string, string> = { BTC: "#f7931a", ETH: "#8aa0c8", SOL: "#14f195", HYPE: "#2ee6b6", RWA: "#e6c069", Others: "#6a7c8e" };

type Pt = { t: number } & Record<string, number>;

export default function SeriesChart({
  title,
  points,
  mode,
  extraKey,
  extraLabel,
  groups = DEFAULT_GROUPS,
  toolbar,
}: {
  title: string;
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
    const total = COINS.reduce((s, c) => s + (p[c] || 0), 0);
    run += total;
    return { ...p, total, cum: run };
  });

  const allKeys = [...COINS, extraKey];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setHidden((h) => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const visible = (k: string) => !hidden.has(k);
  const allOff = allKeys.every((k) => hidden.has(k));

  const xFmt = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  const EXTRA_COLOR = "#6f8bff";
  const TICK = "#647588";
  const AXIS = "rgba(255,255,255,0.10)";

  const toggles = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
      {COINS.map((c) => (
        <Chip key={c} label={c} color={COLORS[c]} on={visible(c)} onClick={() => toggle(c)} />
      ))}
      <Chip label={extraLabel} color={EXTRA_COLOR} on={visible(extraKey)} onClick={() => toggle(extraKey)} />
      <button className="chip" onClick={() => setHidden(allOff ? new Set() : new Set(allKeys))} style={{ cursor: "pointer" }}>
        {allOff ? "Select all" : "Deselect all"}
      </button>
    </div>
  );

  return (
    <ChartCard title={title} height={300} controls={toggles} toolbar={toolbar} filename={`risescreener-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      {data.length < 2 ? (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>
          Builds from periodic snapshots.<br />
          RISEx has no historical API — this fills in as the timeseries cron runs.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 10, left: 6, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 5" vertical={false} />
            <XAxis dataKey="t" tickFormatter={xFmt} tick={{ fill: TICK, fontSize: 10, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} minTickGap={36} />
            <YAxis yAxisId="l" tick={{ fill: TICK, fontSize: 10, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => usd(Number(v))} />
            <YAxis yAxisId="r" orientation="right" tick={{ fill: TICK, fontSize: 10, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => usd(Number(v))} />
            <Tooltip
              contentStyle={{ background: "rgba(10,14,20,0.94)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, fontSize: 11.5, padding: "8px 11px", boxShadow: "0 12px 30px -14px rgba(0,0,0,0.7)", fontFamily: "var(--font)" }}
              labelStyle={{ color: "#8b9bad", marginBottom: 4, fontSize: 10.5 }}
              itemStyle={{ color: "#e7edf3" }}
              cursor={{ stroke: "rgba(255,255,255,0.14)", strokeWidth: 1 }}
              labelFormatter={(t) => xFmt(Number(t))}
              formatter={(v: number, name: string) => [usd(Number(v)), name]}
            />
            {COINS.filter(visible).map((c) =>
              mode === "bars" ? (
                <Bar key={c} yAxisId="l" dataKey={c} stackId="s" fill={COLORS[c]} isAnimationActive={false} />
              ) : (
                <Line key={c} yAxisId="l" type="monotone" dataKey={c} stroke={COLORS[c]} strokeWidth={1.5} dot={false} isAnimationActive={false} />
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
      onClick={onClick}
      className="chip"
      style={{ cursor: "pointer", opacity: on ? 1 : 0.4, borderColor: on ? color : "var(--hair)" }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: "inline-block" }} />
      {label}
    </button>
  );
}
