"use client";

import { useMemo, useState } from "react";
import type { CoinDay } from "@/lib/dune";
import { usd } from "@/lib/format";

type Period = "M" | "Q" | "Y" | "ALL";
const COINS = ["BTC", "ETH", "SOL", "HYPE", "Others"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketKey(t: number, p: Period): { key: string; label: string } {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  if (p === "ALL") return { key: "all", label: "All time" };
  if (p === "Y") return { key: `${y}`, label: `${y}` };
  if (p === "Q") { const q = Math.floor(d.getUTCMonth() / 3) + 1; return { key: `${y}-Q${q}`, label: `Q${q} ${y}` }; }
  return { key: `${y}-${d.getUTCMonth()}`, label: `${MONTHS[d.getUTCMonth()]} ${y}` };
}

type Bucket = { key: string; label: string; total: number; BTC: number; ETH: number; SOL: number; HYPE: number; Others: number };

// aggregate a daily CoinDay[] into period buckets → { key, label, total, per-coin }
function aggregate(days: CoinDay[], p: Period): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const day of days) {
    const { key, label } = bucketKey(day.t, p);
    let b = map.get(key);
    if (!b) { b = { key, label, total: 0, BTC: 0, ETH: 0, SOL: 0, HYPE: 0, Others: 0 }; map.set(key, b); }
    for (const c of COINS) { const v = day[c] || 0; b[c] += v; b.total += v; }
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1)); // newest first
}

export default function FeeBreakdown({ daily, liqDaily }: { daily: CoinDay[]; liqDaily: CoinDay[] }) {
  const [period, setPeriod] = useState<Period>("M");
  const cols = useMemo(() => aggregate(daily, period).slice(0, 12), [daily, period]);
  const liqCols = useMemo(() => {
    const m = new Map<string, Bucket>(aggregate(liqDaily, period).map((b) => [b.key, b] as [string, Bucket]));
    return cols.map((c) => m.get(c.key));
  }, [liqDaily, period, cols]);

  const cell = (v: number | undefined) => (v == null || v === 0 ? <span style={{ color: "var(--muted-2)" }}>$0.00</span> : usd(v));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Revenues &amp; Fees</h2>
        <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "var(--glass-2)", borderRadius: "var(--r-pill)", border: "1px solid var(--hair)" }}>
          {(["M", "Q", "Y", "ALL"] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className="seg-btn" data-active={period === p}>{p}</button>
          ))}
        </div>
      </div>

      <div className="glass glow-edge" style={{ borderRadius: "var(--r-lg)", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
          <thead>
            <tr>
              <th style={hCell(true)}>Metric</th>
              {cols.map((c) => <th key={c.key} style={hCell(false)}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <Row label="Total fees" bold values={cols.map((c) => c.total)} cell={cell} />
            {COINS.map((coin) => <Row key={coin} label={coin} indent={1} muted values={cols.map((c) => (c as any)[coin])} cell={cell} />)}
            <Row label="Liquidation fees" bold values={liqCols.map((c) => c?.total ?? 0)} cell={cell} />
            {COINS.map((coin) => <Row key={"l" + coin} label={coin} indent={1} muted values={liqCols.map((c) => (c ? (c as any)[coin] : 0))} cell={cell} />)}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 10 }}>
        Trading &amp; liquidation fees by market, aggregated by {period === "ALL" ? "all time" : period === "M" ? "month" : period === "Q" ? "quarter" : "year"}. Source: Dune (daily).
      </p>
    </div>
  );
}

function Row({ label, values, cell, bold, indent = 0, muted }: { label: string; values: number[]; cell: (v: number | undefined) => React.ReactNode; bold?: boolean; indent?: number; muted?: boolean }) {
  return (
    <tr style={{ borderTop: "1px solid var(--hair-soft)" }}>
      <td style={{ padding: "9px 16px", paddingLeft: 16 + indent * 18, whiteSpace: "nowrap", fontWeight: bold ? 700 : 400, color: muted ? "var(--muted)" : "var(--ink)", fontStyle: indent ? "normal" : "normal" }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="tnum" style={{ padding: "9px 16px", textAlign: "right", whiteSpace: "nowrap", color: bold ? "var(--ink)" : "var(--muted)" }}>{cell(v)}</td>
      ))}
    </tr>
  );
}

const hCell = (left: boolean): React.CSSProperties => ({
  padding: "11px 16px", textAlign: left ? "left" : "right", whiteSpace: "nowrap",
  color: "var(--muted-2)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase",
  fontWeight: 500, borderBottom: "1px solid var(--hair)", position: "sticky", top: 0,
  background: "color-mix(in oklab, var(--bg-2) 80%, transparent)",
});
