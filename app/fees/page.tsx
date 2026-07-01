import { getDune, type CoinDay } from "@/lib/dune";
import { usd } from "@/lib/format";
import { Panel, SectionLabel, Empty } from "@/components/ui";
import SeriesChart from "@/components/SeriesChart";
import ChartCard from "@/components/ChartCard";
import FeeBreakdown from "@/components/FeeBreakdown";
import { Donut, Spark } from "@/components/charts";

export const revalidate = 60;
export const metadata = { title: "Fees & Revenue — RiseScreener" };

const COINS = ["BTC", "ETH", "SOL", "HYPE", "Others"] as const;
const COIN_COLOR: Record<string, string> = { BTC: "#f7931a", ETH: "#8aa0c8", SOL: "#14f195", HYPE: "#34cfa2", Others: "#6a7c8e" };

function monthlyTotals(days: CoinDay[]): number[] {
  const m = new Map<string, number>();
  for (const d of days) {
    const dt = new Date(d.t);
    const k = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()).padStart(2, "0")}`;
    const tot = COINS.reduce((s, c) => s + (d[c] || 0), 0);
    m.set(k, (m.get(k) || 0) + tot);
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((e) => e[1]);
}
function sumByCoin(days: CoinDay[]) {
  return COINS.map((c) => ({ name: c, value: days.reduce((s, d) => s + (d[c] || 0), 0), color: COIN_COLOR[c] }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

function FeeKpi({ label, value, sub, spark, color = "var(--accent)" }: { label: string; value: string; sub?: string; spark?: number[]; color?: string }) {
  return (
    <div className="glass glow-edge stat-card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, minHeight: 112 }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-2)" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.015em", lineHeight: 1.05 }}>{value}</div>
      {spark && spark.length > 1 ? (
        <div style={{ height: 30, marginTop: 2, marginLeft: -4, marginRight: -4 }}><Spark data={spark} color={color} height={30} /></div>
      ) : (
        <div style={{ height: 30 }} />
      )}
      {sub && <div style={{ fontSize: 10.5, color: "var(--muted-2)" }}>{sub}</div>}
    </div>
  );
}

export default async function FeesPage() {
  const dune = await getDune();
  if (!dune) return <div className="screen"><h1 style={{ fontSize: 22, fontWeight: 700 }}>Fees &amp; Revenue</h1><Empty>Dune snapshot not available.</Empty></div>;

  const { fees, totals } = dune;
  const feeDaily = dune.feesByMarket ?? [];
  const liqDaily = dune.liqFeesByMarket ?? [];
  // daily fee series (last 60d) — fluctuating snapshots, not a monotonic cumulative line
  const dailyTot = feeDaily.map((d) => COINS.reduce((s, c) => s + (d[c] || 0), 0)).slice(-60);
  const dailyLiq = liqDaily.map((d) => COINS.reduce((s, c) => s + (d[c] || 0), 0)).slice(-60);
  const feeTot = fees.taker + fees.maker + fees.liq || 1;
  const takerSpark = dailyTot.map((v) => v * (fees.taker / feeTot));
  const makerSpark = dailyTot.map((v) => v * (fees.maker / feeTot));
  const feeBps = totals.cumVolume > 0 ? (totals.cumFees / totals.cumVolume) * 10_000 : 0;

  const byMarket = sumByCoin(feeDaily);
  const dTotal = byMarket.reduce((s, m) => s + m.value, 0) || 1;
  const feeLegend = byMarket.map((m) => ({ name: m.name, color: m.color, value: usd(m.value), pct: (m.value / dTotal) * 100 }));

  const split = [
    { label: "Taker", v: fees.taker, c: "var(--accent-ink)" },
    { label: "Maker", v: fees.maker, c: "var(--accent-2)" },
    { label: "Liquidation", v: fees.liq, c: "var(--short)" },
  ];
  const splitTotal = split.reduce((s, x) => s + x.v, 0) || 1;

  return (
    <div className="screen" data-page="fees" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Fees &amp; Revenue</h1>
        <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)" }}>Protocol revenue &amp; fee breakdown — trading, liquidation &amp; by market</p>
      </div>

      {/* KPI cards with sparklines */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10 }}>
        <FeeKpi label="Total fees" value={usd(totals.cumFees)} sub="all-time protocol revenue" spark={dailyTot} color="var(--accent)" />
        <FeeKpi label="Taker fees" value={usd(fees.taker)} sub={`${((fees.taker / feeTot) * 100).toFixed(0)}% of fees`} spark={takerSpark} color="var(--accent-ink)" />
        <FeeKpi label="Maker fees" value={usd(fees.maker)} sub={`${((fees.maker / feeTot) * 100).toFixed(0)}% of fees`} spark={makerSpark} color="var(--accent-2)" />
        <FeeKpi label="Liquidation fees" value={usd(fees.liq)} sub={`${((fees.liq / feeTot) * 100).toFixed(0)}% of fees`} spark={dailyLiq} color="var(--short)" />
        <FeeKpi label="Fee / volume" value={`${feeBps.toFixed(2)} bps`} sub="cum fees ÷ cum volume" />
      </div>

      {/* fee composition bar */}
      <Panel pad="15px 18px">
        <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 2 }}>
          {split.map((s) => <div key={s.label} title={`${s.label}: ${usd(s.v)}`} style={{ width: `${(s.v / splitTotal) * 100}%`, background: s.c, borderRadius: 3 }} />)}
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12 }}>
          {split.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: s.c }} />
              <span style={{ color: "var(--muted)" }}>{s.label}</span>
              <span className="tnum" style={{ fontWeight: 600 }}>{usd(s.v)}</span>
              <span className="tnum" style={{ color: "var(--muted-2)" }}>{((s.v / splitTotal) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* breakdown table (ASXN-style) */}
      <FeeBreakdown daily={feeDaily} liqDaily={liqDaily} />

      {/* charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))", gap: 16, alignItems: "stretch" }}>
        <SeriesChart title="Fees by market ($/day)" points={feeDaily} mode="bars" extraKey="cum" extraLabel="Cumulative" />
        <ChartCard title="Fees by market · all-time" height={300} legend={feeLegend} filename="risescreener-fees-by-market">
          {byMarket.length ? <Donut data={byMarket} height="100%" /> : <Empty>No fee data.</Empty>}
        </ChartCard>
      </div>
    </div>
  );
}
