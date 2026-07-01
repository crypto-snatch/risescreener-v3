"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { TrendSeries } from "@/lib/snapshot";
import { usd, shortAddr } from "@/lib/format";
import ChartCard from "@/components/ChartCard";

const TICK = "#647588";
const AXIS = "rgba(255,255,255,0.10)";

// Aggregate (summed) trend across the top-10 wallets — one line, not per-wallet.
export default function WalletTrends({ title, series, filename, sign = false, color = "#34cfa2" }: { title: string; series: TrendSeries; filename: string; sign?: boolean; color?: string }) {
  const accts = series.accounts;
  const data = series.data.map((row) => {
    let sum = 0;
    for (const a of accts) sum += Number(row[a.key] || 0);
    return { t: row.t, total: sum };
  });
  // legend = the wallets composing the aggregate, with their 30d totals
  const legend = accts.map((a) => ({ name: shortAddr(a.account), color, value: usd(a.total, { sign }) }));
  const xFmt = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  const gid = `wt-${filename}`;

  return (
    <ChartCard title={title} height={300} legend={legend} filename={filename}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 12, left: 6, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 5" vertical={false} />
          <XAxis dataKey="t" tickFormatter={xFmt} tick={{ fill: TICK, fontSize: 10, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} minTickGap={40} />
          <YAxis tick={{ fill: TICK, fontSize: 10, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => usd(Number(v))} />
          <Tooltip
            contentStyle={{ background: "rgba(10,14,20,0.94)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, fontSize: 11.5, padding: "8px 11px", fontFamily: "var(--font)" }}
            labelStyle={{ color: "#8b9bad", marginBottom: 4, fontSize: 10.5 }}
            itemStyle={{ color: "#e7edf3" }}
            cursor={{ stroke: "rgba(255,255,255,0.14)", strokeWidth: 1 }}
            labelFormatter={(t) => xFmt(Number(t))}
            formatter={(v: number) => [usd(Number(v), { sign }), "Top 10 combined"]}
          />
          <Area type="monotone" dataKey="total" stroke={color} strokeWidth={1.9} fill={`url(#${gid})`} isAnimationActive={false} activeDot={{ r: 3, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
