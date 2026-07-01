import Link from "next/link";
import { getProtocol, getMarketRows, isUpcoming, type MarketRow } from "@/lib/analytics";
import { getDune } from "@/lib/dune";
import { usd, compact, price } from "@/lib/format";
import { Panel, Stat } from "@/components/ui";
import ShredPulse from "@/components/ShredPulse";
import SeriesChart from "@/components/SeriesChart";
import { AreaTrend } from "@/components/charts";
import OiDonut from "@/components/OiDonut";

export const revalidate = 20;

const OI_COLORS: Record<string, string> = {
  BTC: "#6e74d6", HYPE: "#ff7a4d", ETH: "#9aa3b8", NEAR: "#c77dd6", SOL: "#f5c542",
  ZEC: "#5b8def", BNB: "#f0b90b", XRP: "#7fd6a0", DOGE: "#cdb36a", TAO: "#46c9b0",
};

export default async function Overview() {
  const [p, rows, dune] = await Promise.all([getProtocol(), getMarketRows(), getDune()]);

  const tradable = rows.filter((r) => !isUpcoming(r));
  const topOI = [...rows].sort((a, b) => b.oiUsd - a.oiUsd).slice(0, 5);
  const topVol = [...rows].sort((a, b) => b.volume24h - a.volume24h).slice(0, 5);
  const topGainer = [...tradable].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const topLoser = [...tradable].sort((a, b) => a.changePct - b.changePct).slice(0, 5);
  const pct = (r: MarketRow) => `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`;

  const volPoints = dune?.volume ?? [];
  const tvlPoints = (dune?.tvl ?? []).map((x) => ({ t: x.t, tvl: x.tvl }));
  const oiDonut = (dune?.oiByMarket ?? [])
    .filter((x) => x.oiUsd > 0)
    .map((x) => ({ name: x.symbol, value: x.oiUsd, color: OI_COLORS[x.symbol] ?? "#6e857e" }));

  return (
    <div className="screen" data-page="overview" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Overview</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
        <Stat big label="TVL" value={usd(dune?.totals.tvl ?? p.tvl)} tone="accent" />
        <Stat big label="Total open interest" value={usd(dune?.totals.oi ?? p.totalOiUsd)} />
        <Stat big label="24h volume" value={usd(p.totalVolume24h)} />
        <Stat big label="Cumulative volume" value={usd(dune?.totals.cumVolume ?? 0)} tone="accent" />
        <Stat big label="Total fees" value={usd(dune?.totals.cumFees ?? 0)} />
        <Stat big label="Accounts" value={compact(dune?.totals.accounts ?? p.wallets.total)} />
        <Stat big label="Listed markets" value={String(p.listedMarkets)} />
        <Stat big label="Upcoming markets" value={String(p.upcomingMarkets)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px,1fr))", gap: 16 }}>
        <SeriesChart title="Cum Vol" points={volPoints} mode="bars" extraKey="cum" extraLabel="Cumulative" />
        <Panel pad="14px 16px">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>OI</div>
          {oiDonut.length > 0 ? (
            <OiDonut data={oiDonut} height={340} />
          ) : (
            <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>no data</div>
          )}
        </Panel>
        <Panel pad="14px 16px">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>TVL</div>
          {tvlPoints.length > 1 ? (
            <AreaTrend data={tvlPoints} xKey="t" yKey="tvl" xPreset="date" yPreset="usd" valueName="TVL" height={300} />
          ) : (
            <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>no data</div>
          )}
        </Panel>
      </div>

      <ShredPulse />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 16 }}>
        <TopTable title="Top OI" rows={topOI} render={(r) => usd(r.oiUsd)} />
        <TopTable title="Top Volume" rows={topVol} render={(r) => usd(r.volume24h)} />
        <TopTable title="Top Gainer (24h)" rows={topGainer} render={pct} tone={(r) => (r.changePct >= 0 ? "long" : "short")} />
        <TopTable title="Top Loser (24h)" rows={topLoser} render={pct} tone={(r) => (r.changePct >= 0 ? "long" : "short")} />
      </div>
    </div>
  );
}

function TopTable({
  title,
  rows,
  render,
  tone,
}: {
  title: string;
  rows: MarketRow[];
  render: (r: MarketRow) => string;
  tone?: (r: MarketRow) => "long" | "short";
}) {
  return (
    <Panel>
      <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--hair)", fontWeight: 700, fontSize: 13 }}>{title}</div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {rows.map((r, i) => (
          <li key={r.marketId} className="row" style={{ gridTemplateColumns: "18px 1fr auto", display: "grid" }}>
            <span className="text-muted" style={{ fontSize: 11 }}>{i + 1}</span>
            <Link href={`/markets/${r.marketId}`} className="mono-link" style={{ fontWeight: 700 }}>
              {r.symbol} <span className="text-muted" style={{ fontWeight: 400 }}>${price(r.mark)}</span>
            </Link>
            <span className="tnum" style={{ color: tone ? `var(--${tone(r)})` : "var(--accent-ink)" }}>{render(r)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
