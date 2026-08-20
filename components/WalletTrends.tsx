"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { TrendSeries } from "@/lib/snapshot";
import { usd, shortAddr } from "@/lib/format";
import ChartCard from "@/components/ChartCard";

const TICK = "#9aa6b2";
const AXIS = "rgba(255,255,255,0.10)";

// Aggregate (summed) trend across the indexed leaders. Some index snapshots only
// contain the ranked totals because RISEx's per-wallet fill-history requests were
// rate-limited. Never render an empty plot in that case: show the values that were
// actually indexed as a horizontal ranking and label the fallback explicitly.
export default function WalletTrends({
  title,
  subtitle,
  series,
  filename,
  sign = false,
  color = "#34cfa2",
}: {
  title: string;
  subtitle: string;
  series: TrendSeries;
  filename: string;
  sign?: boolean;
  color?: string;
}) {
  const accts = series.accounts;
  const data = series.data.map((row) => {
    let sum = 0;
    for (const a of accts) sum += Number(row[a.key] || 0);
    return { t: Number(row.t), total: sum };
  }).filter((row) => Number.isFinite(row.t) && Number.isFinite(row.total)).sort((a, b) => a.t - b.t);
  const hasTimeline = data.length > 1 && data[0].t !== data[data.length - 1].t;
  const ranking = accts
    .filter((account) => Number.isFinite(account.total))
    .map((account) => ({ account: account.account, name: shortAddr(account.account), total: Number(account.total) }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  const latest = data[data.length - 1]?.total;
  const legend = hasTimeline && latest != null
    ? [{ name: `${accts.length} indexed accounts combined`, color, value: usd(latest, { sign }) }]
    : undefined;
  const xFmt = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  const gid = `wt-${filename}`;

  return (
    <ChartCard
      title={title}
      subtitle={`${subtitle} · ${hasTimeline ? "daily indexed history" : "ranked snapshot (timeline unavailable)"}`}
      height={300}
      modalHeight={460}
      legend={legend}
      filename={filename}
    >
      <ResponsiveContainer width="100%" height="100%">
        {hasTimeline ? (
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 6, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 5" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={xFmt} tick={{ fill: TICK, fontSize: 11, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} minTickGap={40} />
            <YAxis tick={{ fill: TICK, fontSize: 11, fontFamily: "var(--font)" }} stroke={AXIS} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => usd(Number(v))} />
            <Tooltip
              contentStyle={{ background: "rgba(10,14,20,0.94)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, fontSize: 11.5, padding: "8px 11px", fontFamily: "var(--font)" }}
              labelStyle={{ color: "#8b9bad", marginBottom: 4, fontSize: 10.5 }}
              itemStyle={{ color: "#e7edf3" }}
              cursor={{ stroke: "rgba(255,255,255,0.14)", strokeWidth: 1 }}
              labelFormatter={(t) => xFmt(Number(t))}
              formatter={(v: number) => [usd(Number(v), { sign }), `${accts.length} accounts combined`]}
            />
            <Area type="monotone" dataKey="total" stroke={color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} activeDot={{ r: 3, strokeWidth: 0 }} />
          </AreaChart>
        ) : (
          <BarChart data={ranking} layout="vertical" margin={{ top: 4, right: 20, left: 2, bottom: 2 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 5" horizontal={false} />
            <XAxis type="number" tick={{ fill: TICK, fontSize: 10.5, fontFamily: "var(--font)" }} tickFormatter={(value) => usd(Number(value))} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" width={86} tick={{ fill: "#c7d0d9", fontSize: 10.5, fontFamily: "var(--font)" }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "rgba(10,14,20,0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 11.5, padding: "8px 11px", fontFamily: "var(--font)" }}
              labelStyle={{ color: "#aab5c2", marginBottom: 4, fontSize: 10.5 }}
              itemStyle={{ color: "#e7edf3" }}
              cursor={{ fill: "rgba(255,255,255,0.035)" }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.account ?? ""}
              formatter={(v: number) => [usd(Number(v), { sign }), "Indexed value"]}
            />
            <Bar dataKey="total" radius={[0, 5, 5, 0]} maxBarSize={15} isAnimationActive={false} activeBar={{ fillOpacity: 1, stroke: "rgba(255,255,255,.35)", strokeWidth: 1 }}>
              {ranking.map((row) => <Cell key={row.account} fill={row.total < 0 ? "#ef6379" : color} fillOpacity={0.82} />)}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  );
}
