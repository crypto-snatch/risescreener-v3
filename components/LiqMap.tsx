"use client";

import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import type { LiqMapMarket } from "@/lib/snapshot";
import { usd } from "@/lib/format";
import ChartCard from "@/components/ChartCard";

const LONG = "#3fdd9a";
const SHORT = "#ff6b7d";
const TICK = "#647588";

const priceFmt = (p: number) => (p >= 1000 ? `$${(p / 1000).toFixed(1)}K` : `$${p.toFixed(p < 10 ? 3 : 2)}`);

export default function LiqMap({ markets, height = 460 }: { markets: LiqMapMarket[]; height?: number }) {
  const [sym, setSym] = useState(markets[0]?.symbol);
  const m = markets.find((x) => x.symbol === sym) ?? markets[0];
  if (!m) return null;

  // high price on top → reverse bins
  const data = [...m.bins].reverse().map((b) => ({ label: priceFmt(b.price), price: b.price, longUsd: b.longUsd, shortUsd: b.shortUsd }));
  let markLabel = data[0]?.label;
  let best = Infinity;
  for (const d of data) { const dist = Math.abs(d.price - m.mark); if (dist < best) { best = dist; markLabel = d.label; } }

  const selector = (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
      {markets.map((mk) => (
        <button key={mk.symbol} className="seg-btn" data-active={mk.symbol === m.symbol} onClick={() => setSym(mk.symbol)}>{mk.symbol}</button>
      ))}
    </div>
  );

  return (
    <ChartCard title={`Liquidation map · ${m.symbol}`} height={height} controls={selector} filename={`risescreener-liqmap-${m.symbol}`}
      toolbar={<span style={{ fontSize: 11, color: "var(--muted)" }} className="tnum">mark {priceFmt(m.mark)} · {m.count} pos</span>}
      legend={[{ name: "Long liq (below mark)", color: LONG }, { name: "Short liq (above mark)", color: SHORT }]}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barCategoryGap={1}>
          <XAxis type="number" tick={{ fill: TICK, fontSize: 10, fontFamily: "var(--font)" }} stroke="rgba(255,255,255,0.10)" tickLine={false} axisLine={false} tickFormatter={(v) => usd(Number(v))} />
          <YAxis type="category" dataKey="label" width={62} tick={{ fill: TICK, fontSize: 9.5, fontFamily: "var(--font)" }} stroke="rgba(255,255,255,0.10)" tickLine={false} axisLine={false} interval={1} reversed={false} />
          <Tooltip
            contentStyle={{ background: "rgba(10,14,20,0.94)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, fontSize: 11.5, padding: "8px 11px", fontFamily: "var(--font)" }}
            labelStyle={{ color: "#8b9bad", marginBottom: 4, fontSize: 10.5 }}
            itemStyle={{ color: "#e7edf3" }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            formatter={(v: number, n: string) => [usd(Number(v)), n === "longUsd" ? "Long liq" : "Short liq"]}
            labelFormatter={(l) => `Price ${l}`}
          />
          <ReferenceLine y={markLabel} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.4}
            label={{ value: `MARK ${priceFmt(m.mark)}`, position: "right", fill: "var(--accent-ink)", fontSize: 10, fontFamily: "var(--font)" }} />
          <Bar dataKey="longUsd" stackId="s" fill={LONG} radius={[0, 2, 2, 0]} isAnimationActive animationDuration={480} />
          <Bar dataKey="shortUsd" stackId="s" fill={SHORT} radius={[0, 2, 2, 0]} isAnimationActive animationDuration={480} />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
