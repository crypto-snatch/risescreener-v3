"use client";

import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from "recharts";
import { usd } from "@/lib/format";

const GROUPS = ["BTC", "ETH", "SOL", "HYPE"];
const COLORS: Record<string, string> = { BTC: "#f7931a", ETH: "#8aa0c8", SOL: "#14f195", HYPE: "#2dd4bf", Others: "#6e857e" };

export default function MarketBreakdown({
  rows,
  totalOi,
  totalVol,
}: {
  rows: { symbol: string; oi: number; vol: number }[];
  totalOi: number;
  totalVol: number;
}) {
  const [tab, setTab] = useState<"oi" | "vol">("oi");
  const pick = (r: { oi: number; vol: number }) => (tab === "oi" ? r.oi : r.vol);

  const grouped = GROUPS.map((g) => ({ label: g, v: Math.round(rows.filter((r) => r.symbol === g).reduce((s, r) => s + pick(r), 0)) }));
  const others = Math.round(rows.filter((r) => !GROUPS.includes(r.symbol)).reduce((s, r) => s + pick(r), 0));
  const data = [...grouped, { label: "Others", v: others }];
  const total = tab === "oi" ? totalOi : totalVol;

  return (
    <div className="glass glow-edge" style={{ padding: "14px 16px", borderRadius: "var(--r-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {([["oi", "Open Interest"], ["vol", "Volume (24h)"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="pill" data-active={tab === k}>{l}</button>
          ))}
        </div>
        <span className="chip">{usd(total)} total</span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: "#9cb2ab", fontSize: 12, fontWeight: 600 }} stroke="rgba(255,255,255,0.08)" />
          <YAxis tick={{ fill: "#7f968e", fontSize: 10 }} stroke="rgba(255,255,255,0.08)" width={56} tickFormatter={(v) => usd(Number(v))} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{ background: "#0b1413", border: "1px solid var(--hair)", borderRadius: 4, fontSize: 11 }}
            labelStyle={{ color: "#9cb2ab" }}
            formatter={(v: number) => [usd(Number(v)), tab === "oi" ? "OI" : "Volume"]}
          />
          <Bar dataKey="v" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={COLORS[d.label]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8, fontSize: 10.5 }}>
        {data.map((d) => (
          <span key={d.label} style={{ color: "var(--muted)" }}>
            <span style={{ color: COLORS[d.label] }}>■</span> {d.label} {usd(d.v)}
          </span>
        ))}
      </div>
    </div>
  );
}
