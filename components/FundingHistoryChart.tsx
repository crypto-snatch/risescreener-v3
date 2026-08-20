"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard from "@/components/ChartCard";

export interface FundingHistorySeries {
  name: string;
  points: { t: number; ratePct: number }[];
}

const COLORS = ["#2ee88e", "#7d8cff", "#e6c069", "#e46a7b", "#59c2ff", "#c77dd6"];

export default function FundingHistoryChart({ series }: { series: FundingHistorySeries[] }) {
  const data = useMemo(() => {
    const rows = new Map<number, Record<string, number>>();
    for (const item of series) {
      for (const point of item.points) {
        const bucket = Math.floor(point.t / 3_600_000) * 3_600_000;
        const row = rows.get(bucket) ?? { t: bucket };
        row[item.name] = point.ratePct;
        rows.set(bucket, row);
      }
    }
    return [...rows.values()].sort((a, b) => a.t - b.t);
  }, [series]);

  return (
    <ChartCard
      title="Funding rate history"
      subtitle="Published hourly observations · percent per funding interval"
      height={320}
      modalHeight={480}
      filename="risescreener-funding-history"
    >
      {data.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: 2 }}>
            <CartesianGrid stroke="rgba(255,255,255,.07)" strokeDasharray="2 5" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value) => new Date(Number(value)).toLocaleString("en-GB", { day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
              tick={{ fill: "#9aa6b2", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,.12)" }}
              tickLine={false}
              minTickGap={58}
            />
            <YAxis
              tickFormatter={(value) => `${Number(value).toFixed(3)}%`}
              tick={{ fill: "#9aa6b2", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={62}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,.22)" />
            <Tooltip
              labelFormatter={(value) => new Date(Number(value)).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
              formatter={(value: number, name: string) => [`${Number(value).toFixed(5)}%`, name]}
              contentStyle={{ background: "#111614", border: "1px solid rgba(255,255,255,.12)", borderRadius: 7, fontSize: 12 }}
              labelStyle={{ color: "#a1abb7", marginBottom: 5 }}
            />
            <Legend wrapperStyle={{ color: "#a1abb7", fontSize: 11.5, paddingTop: 8 }} />
            {series.map((item, index) => (
              <Line
                key={item.name}
                dataKey={item.name}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={1.8}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12 }}>
          Funding history is temporarily unavailable.
        </div>
      )}
    </ChartCard>
  );
}
