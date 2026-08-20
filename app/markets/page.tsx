import { getMarketRows, getProtocol, isUpcoming } from "@/lib/analytics";
import { getDune } from "@/lib/dune";
import { usd } from "@/lib/format";
import { Stat, SectionLabel, Empty } from "@/components/ui";
import MarketsTable from "@/components/MarketsTable";
import ChartCard from "@/components/ChartCard";
import { Donut, GroupBars } from "@/components/charts";
import { categoryOf, CAT_COLOR } from "@/lib/sectors";
import { getTimeseries } from "@/lib/timeseries";
import { patchVolume } from "@/lib/volume";

export const revalidate = 15;
export const metadata = { title: "Markets — RiseScreener" };

export default async function MarketsPage() {
  const [rows, p, dune, timeseries] = await Promise.all([getMarketRows(), getProtocol(), getDune(), getTimeseries()]);
  const patchedVolume = patchVolume(dune, timeseries);
  const tradable = rows.filter((r) => !isUpcoming(r));

  // OI by sector
  const bySector: Record<string, number> = {};
  for (const r of tradable) { const c = categoryOf(r.symbol); bySector[c] = (bySector[c] || 0) + r.oiUsd; }
  const sectorOi = Object.entries(bySector).map(([name, value]) => ({ name, value, color: CAT_COLOR[name] ?? "#6a7c8e" })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const sectorTot = sectorOi.reduce((s, x) => s + x.value, 0) || 1;
  const sectorLegend = sectorOi.map((x) => ({ name: x.name, color: x.color, value: usd(x.value), pct: (x.value / sectorTot) * 100 }));

  // top markets by OI
  const oiLeaders = [...tradable].sort((a, b) => b.oiUsd - a.oiUsd).slice(0, 8).map((r) => ({ label: r.symbol, v: r.oiUsd, color: CAT_COLOR[categoryOf(r.symbol)] ?? "#34cfa2" }));

  return (
    <div className="screen" data-page="markets" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Perp Markets</h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>Real-time data from RISEx · {rows.length} markets</p>
      </div>

      {/* summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 10 }}>
        <Stat big label="24h Volume" value={usd(p.totalVolume24h)} tone="accent" />
        <Stat big label="Total Open Interest" value={usd(p.totalOiUsd)} hint="live RISEx books" />
        <Stat big label="Cumulative Volume" value={usd(patchedVolume.cumVolume)} hint={patchedVolume.estDays ? `${patchedVolume.estDays} missing Dune day${patchedVolume.estDays === 1 ? "" : "s"} rebuilt` : undefined} />
        <Stat big label="Active Markets" value={String(p.marketsCount)} hint="matches the current RISEx venue" />
      </div>

      {/* analytics charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px,1fr))", gap: 16, alignItems: "stretch" }}>
        <ChartCard title="Open interest by sector" subtitle="Live RISEx notional · sector share" height={280} legend={sectorLegend} filename="risescreener-oi-by-sector">
          {sectorOi.length ? <Donut data={sectorOi} height="100%" /> : <Empty>No data.</Empty>}
        </ChartCard>
        <ChartCard title="Top markets by open interest" subtitle="Live USD notional · largest eight active markets" height={280} filename="risescreener-oi-leaders">
          {oiLeaders.length ? <GroupBars data={oiLeaders} height={280} /> : <Empty>No data.</Empty>}
        </ChartCard>
      </div>

      <SectionLabel>All markets</SectionLabel>
      <MarketsTable rows={rows} />
    </div>
  );
}
