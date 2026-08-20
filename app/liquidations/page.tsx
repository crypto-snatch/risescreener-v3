import { getDune, type CoinDay } from "@/lib/dune";
import { getSnapshot } from "@/lib/snapshot";
import { usd, compact, price, shortAddr } from "@/lib/format";
import { Panel, Stat, SectionLabel, Empty } from "@/components/ui";
import SeriesChart from "@/components/SeriesChart";
import ChartCard from "@/components/ChartCard";
import LiqHeatmap from "@/components/LiqHeatmap";
import LiqMap from "@/components/LiqMap";
import { Donut } from "@/components/charts";
import { LiqLevels } from "@/components/viz";
import { getMarketRows } from "@/lib/analytics";
import { getLiquidationHeatmap } from "@/lib/risescan";
import { price as fmtPx } from "@/lib/format";
import { dayTotal as sumDay } from "@/lib/volume";

export const revalidate = 60;
export const metadata = { title: "Liquidations — RiseScreener" };

const GROUPS = ["BTC", "ETH", "SOL", "HYPE", "Commodities", "Stocks", "Others"] as const;
const COIN_COLOR: Record<string, string> = { BTC: "#f7931a", ETH: "#8aa0c8", SOL: "#14f195", HYPE: "#34cfa2", Commodities: "#e6c069", Stocks: "#5fa8ff", Others: "#6a7c8e" };

function sumByCoin(days: CoinDay[]): { name: string; value: number; color: string }[] {
  return GROUPS.map((c) => ({ name: c, value: days.reduce((s, d) => s + Number(d[c] || 0), 0), color: COIN_COLOR[c] }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

export default async function LiquidationsPage() {
  const [dune, snap, rows] = await Promise.all([getDune(), getSnapshot(), getMarketRows()]);
  if (!dune) return <div className="screen"><h1 style={{ fontSize: 22, fontWeight: 700 }}>Liquidations</h1><Empty>Dune snapshot not available.</Empty></div>;

  // real liquidation heatmaps (RISEx Analytics API) for the two deepest markets
  const topMkts = rows.filter((r) => r.active && r.mark > 0).sort((a, b) => b.oiUsd - a.oiUsd).slice(0, 2);
  const heatmaps = await Promise.all(topMkts.map((m) => getLiquidationHeatmap(m.marketId).catch(() => [])));
  const liqHeat = topMkts.map((m, i) => ({ symbol: m.symbol, mark: m.mark, bins: heatmaps[i] })).filter((x) => x.bins.length > 0);
  // Give every returned price band a real row. The API currently returns about
  // 30–35 bands for the deepest markets; a short fixed plot forced an internal
  // scrollbar and made the bottom levels look clipped.
  const bandChartHeight = Math.max(
    720,
    // 144px reserves the title/legend/mark lanes even when the legend wraps
    // on a 390px viewport; 128px left the final ETH band clipped by 11px.
    ...liqHeat.map((market) => market.bins.filter((bin) => bin.longUsd + bin.shortUsd > 0).length * 18 + 144),
  );

  const liq = dune.liqTotals;
  const avgSize = liq.count > 0 ? liq.volume / liq.count : 0;
  const liqDays = dune.liqFeesByMarket ?? [];
  const byMarket = sumByCoin(liqDays);
  const liqTotal = byMarket.reduce((s, m) => s + m.value, 0) || 1;
  const liqLegend = byMarket.map((m) => ({ name: m.name, color: m.color, value: usd(m.value), pct: (m.value / liqTotal) * 100 }));

  // "24h" = most recent day that actually had liquidations (Dune drops the partial current day)
  const lastDay = [...liqDays].reverse().find((d) => sumDay(d) > 0);
  const by24 = lastDay ? GROUPS.map((c) => ({ name: c, value: Number(lastDay[c] || 0), color: COIN_COLOR[c] })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value) : [];
  const fees24 = by24.reduce((s, m) => s + m.value, 0);

  const heatAll = byMarket.map((m) => ({ name: m.name, size: m.value, color: m.color }));
  const heat24 = by24.map((m) => ({ name: m.name, size: m.value, color: m.color }));
  const marketRows = GROUPS.map((c) => ({ sym: c, color: COIN_COLOR[c], all: byMarket.find((m) => m.name === c)?.value ?? 0, d24: Number(lastDay?.[c] ?? 0) })).filter((r) => r.all > 0).sort((a, b) => b.all - a.all);

  const atRisk = (snap?.atRisk ?? []).filter((p) => p.distPct != null);
  const liqMap = snap?.liqMap ?? [];

  return (
    <div className="screen" data-page="liquidations" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Liquidations</h1>
        <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)" }}>Liquidation flow, size & fees across RISEx markets</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 10 }}>
        <Stat big label="Liquidations" value={compact(liq.count)} tone="short" hint="all-time count" />
        <Stat big label="Liquidated volume" value={usd(liq.volume)} />
        <Stat big label="Liquidation fees" value={usd(liq.fees)} />
        <Stat big label="24h liq fees" value={usd(fees24)} tone="short" hint={lastDay ? "latest active day" : "no recent liqs"} />
        <Stat big label="Avg liquidation" value={usd(avgSize)} hint="volume ÷ count" />
      </div>

      {liqHeat.length > 0 && (
        <div>
          <SectionLabel>Liquidation heatmap · notional at risk by price level</SectionLabel>
          <div className="liquidation-band-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${liqHeat.length}, minmax(0,1fr))`, gap: 16, alignItems: "start" }}>
            {liqHeat.map((h) => (
              <ChartCard
                key={h.symbol}
                title={`${h.symbol} liquidation bands`}
                subtitle="Indexed position notional grouped by estimated liquidation price"
                height={bandChartHeight}
                modalHeight={bandChartHeight}
                toolbar={<span className="tnum text-muted" style={{ fontSize: 11.5 }}>mark ${fmtPx(h.mark)}</span>}
                filename={`risescreener-${h.symbol.toLowerCase()}-liquidation-bands`}
              >
                <LiqLevels bins={h.bins} currentPrice={h.mark} />
              </ChartCard>
            ))}
          </div>
          <p style={{ margin: "10px 1px 0", color: "var(--muted-2)", fontSize: 11.5, lineHeight: 1.55 }}>
            Each band shows the notional whose estimated liquidation price falls there. Longs (green) get liquidated as price falls below the mark; shorts (red) as it rises above. From indexed positions via the RISEx Analytics API.
          </p>
        </div>
      )}

      {/* dual fee heat maps: 24h + all-time */}
      <div>
        <SectionLabel>Liquidation fee heat map · 24h vs all-time</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16, alignItems: "stretch" }}>
          <ChartCard title={`Latest active-day liquidation fees · ${usd(fees24)}`} subtitle="Aligned market tiles · value and share · most recent complete UTC day with liquidations" height={120} modalHeight={220} filename="risescreener-liq-heatmap-24h">
            {heat24.length ? <LiqHeatmap data={heat24} height="100%" /> : <Empty>No liquidations in the last active day.</Empty>}
          </ChartCard>
          <ChartCard title={`All-time liquidation fees · ${usd(liqTotal)}`} subtitle="Aligned market tiles · cumulative value and share by market group" height={120} modalHeight={220} filename="risescreener-liq-heatmap-all">
            {heatAll.length ? <LiqHeatmap data={heatAll} height="100%" /> : <Empty>No data.</Empty>}
          </ChartCard>
        </div>
      </div>

      {/* per-market table: 24h + all-time */}
      {marketRows.length > 0 && (
        <div>
          <SectionLabel>Liquidations by market</SectionLabel>
          <Panel style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 480 }}>
              <thead><tr><Th>Market</Th><Th right>24h fees</Th><Th right>All-time fees</Th><Th right>Share</Th></tr></thead>
              <tbody>
                {marketRows.map((r) => (
                  <tr key={r.sym} style={{ borderBottom: "1px solid var(--hair-soft)" }}>
                    <Td><span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: r.color }} />{r.sym}</span></Td>
                    <Td right mono color={r.d24 > 0 ? "var(--short)" : "var(--muted-2)"}>{r.d24 > 0 ? usd(r.d24) : "—"}</Td>
                    <Td right mono>{usd(r.all)}</Td>
                    <Td right mono color="var(--muted)">{((r.all / liqTotal) * 100).toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}

      {liqMap.length > 0 && (
        <div>
          <SectionLabel>Liquidation map · notional by price level {snap?.sampled && <span className="chip" title={`From ${snap.scoredAccounts} of ${snap.totalAccounts} indexed accounts (dev sample).`} style={{ marginLeft: 6, fontSize: 10 }}>sample · {snap.scoredAccounts}/{snap.totalAccounts} accts</span>}</SectionLabel>
          <LiqMap markets={liqMap} height={460} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))", gap: 16, alignItems: "stretch" }}>
        <SeriesChart title="Liq fees by market ($/day)" subtitle="Complete UTC-day Dune buckets · RWA split by asset class" points={dune.liqFeesByMarket ?? []} mode="bars" extraKey="cum" extraLabel="Cumulative" />
        <ChartCard title="Liquidation fees by market · all-time" subtitle="Cumulative contribution by market group" height={300} legend={liqLegend} filename="risescreener-liquidations-by-market">
          {byMarket.length ? <Donut data={byMarket} height="100%" /> : <Empty>No liquidation data yet.</Empty>}
        </ChartCard>
      </div>

      {/* forward-looking risk — from the account indexer (positions + derived liq price) */}
      <div>
        <SectionLabel>Positions at risk · nearest to liquidation</SectionLabel>
        {atRisk.length ? (
          <Panel style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  <Th>Account</Th><Th>Market</Th><Th>Side</Th><Th right>Leverage</Th>
                  <Th right>Mark</Th><Th right>Est. liq</Th><Th right>Notional</Th><Th right>Distance</Th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--hair-soft)" }}>
                    <Td><a className="mono-link" href={`/address/${p.account}`}>{shortAddr(p.account)}</a></Td>
                    <Td><span style={{ fontWeight: 600 }}>{p.symbol}</span></Td>
                    <Td><span style={{ color: p.side === "long" ? "var(--long)" : "var(--short)", fontWeight: 600 }}>{p.side.toUpperCase()}</span></Td>
                    <Td right mono>{p.lev.toFixed(0)}×</Td>
                    <Td right mono>{price(p.mark)}</Td>
                    <Td right mono>{price(p.liqPrice)}</Td>
                    <Td right mono>{usd(p.notional)}</Td>
                    <Td right mono color={(p.distPct ?? 0) < 3 ? "var(--short)" : (p.distPct ?? 0) < 8 ? "var(--warn)" : "var(--muted)"}>
                      {(p.distPct ?? 0).toFixed(1)}%
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ) : (
          <Panel pad="22px 20px"><div style={{ fontSize: 13, color: "var(--muted)" }}>No at-risk positions in the current index — run the indexer to populate.</div></Panel>
        )}
        <p style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 10 }}>
          Liquidation price is an isolated-margin estimate (entry, leverage, maintenance margin) — cross-margin accounts
          have extra buffer, so this is conservative. Distance = |mark − est. liq| ÷ mark.
        </p>
      </div>

      <p style={{ fontSize: 11, color: "var(--muted-2)" }}>Historical liquidations from Dune (refreshed daily). The in-progress UTC day is excluded from charts.</p>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontWeight: 400, padding: "11px 14px", textAlign: right ? "right" : "left", color: "var(--muted-2)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid var(--hair)" }}>{children}</th>;
}
function Td({ children, right, mono, color }: { children: React.ReactNode; right?: boolean; mono?: boolean; color?: string }) {
  return <td className={mono ? "tnum" : undefined} style={{ padding: "10px 14px", textAlign: right ? "right" : "left", whiteSpace: "nowrap", color: color || "var(--ink)" }}>{children}</td>;
}
