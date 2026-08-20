import Link from "next/link";
import { getMarketRows, isUpcoming, type MarketRow } from "@/lib/analytics";
import { getDune, type CoinDay } from "@/lib/dune";
import { getTimeseries } from "@/lib/timeseries";
import { patchVolume } from "@/lib/volume";
import {
  CMD_SYMBOLS,
  STOCK_SYMBOLS,
  RWA_SYMBOLS,
  RWA_NAMES,
  RWA_COLORS,
  CLASS_COLOR,
  type AssetClass,
} from "@/lib/sectors";
import { price, usd } from "@/lib/format";
import { Panel, SectionLabel, Stat } from "@/components/ui";
import ChartCard from "@/components/ChartCard";
import SeriesChart from "@/components/SeriesChart";
import CoinLogo from "@/components/CoinLogo";
import { Donut } from "@/components/charts";

export const revalidate = 15;
export const metadata = { title: "RWA Markets — RiseScreener" };

const sum = <T,>(items: T[], read: (item: T) => number) => items.reduce((total, item) => total + read(item), 0);
const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

// Old Dune rows expose only RWA/XAU/XAG, while current rows contain both class
// aggregates and all 11 market fields. Prefer the aggregate, then the explicit
// markets; a legacy unsplit RWA bucket belongs to Commodities (stocks were not
// listed when that schema was produced).
function splitDay(day: CoinDay): { Commodities: number; Stocks: number } {
  const cmdDirect = CMD_SYMBOLS.reduce((total, symbol) => total + (Number(day[symbol as keyof CoinDay]) || 0), 0);
  const stockDirect = STOCK_SYMBOLS.reduce((total, symbol) => total + (Number(day[symbol as keyof CoinDay]) || 0), 0);
  const Commodities = Math.max(Number(day.Commodities) || 0, cmdDirect);
  const Stocks = Math.max(Number(day.Stocks) || 0, stockDirect);
  if (Commodities + Stocks > 0) return { Commodities, Stocks };
  return { Commodities: Number(day.RWA) || 0, Stocks: 0 };
}

function classBaseTotals(dune: Awaited<ReturnType<typeof getDune>>, rawCmd: number, rawStocks: number) {
  const stock = Math.max(dune?.totals.cumVolumeStk ?? 0, rawStocks);
  const legacyRwa = dune?.totals.cumVolumeRwa ?? 0;
  const declaredCommodity = dune?.totals.cumVolumeCmd ?? (legacyRwa > 0 ? Math.max(0, legacyRwa - stock) : 0);
  const commodity = Math.max(declaredCommodity, rawCmd);
  return { Commodities: commodity, Stocks: stock };
}

export default async function RwaPage() {
  const [allRows, dune, timeseries] = await Promise.all([getMarketRows(), getDune(), getTimeseries()]);
  const tradable = allRows.filter((row) => !isUpcoming(row));
  const bySymbol = new Map(tradable.map((row) => [row.symbol, row]));
  const rwaRows = RWA_SYMBOLS.map((symbol) => bySymbol.get(symbol)).filter((row): row is MarketRow => Boolean(row));
  const commodityRows = CMD_SYMBOLS.map((symbol) => bySymbol.get(symbol)).filter((row): row is MarketRow => Boolean(row));
  const stockRows = STOCK_SYMBOLS.map((symbol) => bySymbol.get(symbol)).filter((row): row is MarketRow => Boolean(row));

  const totalOi = sum(tradable, (row) => row.oiUsd);
  const totalVolume = sum(tradable, (row) => row.volume24h);
  const rwaOi = sum(rwaRows, (row) => row.oiUsd);
  const rwaVolume = sum(rwaRows, (row) => row.volume24h);

  const patched = patchVolume(dune, timeseries);
  const rawSplit = (dune?.volume ?? []).map(splitDay);
  const patchedSplit = patched.volume.map(splitDay);
  const rawCmd = sum(rawSplit, (day) => day.Commodities);
  const rawStocks = sum(rawSplit, (day) => day.Stocks);
  const patchedCmd = sum(patchedSplit, (day) => day.Commodities);
  const patchedStocks = sum(patchedSplit, (day) => day.Stocks);
  const base = classBaseTotals(dune, rawCmd, rawStocks);
  const cumulativeCmd = Math.max(0, base.Commodities + Math.max(0, patchedCmd - rawCmd));
  const cumulativeStocks = Math.max(0, base.Stocks + Math.max(0, patchedStocks - rawStocks));
  const cumulativeRwa = cumulativeCmd + cumulativeStocks;

  const dailyAll = patched.volume.map((day) => ({ t: day.t, est: day.est, ...splitDay(day) }));
  const firstRwaDay = dailyAll.findIndex((day) => day.Commodities + day.Stocks > 0);
  const daily = firstRwaDay >= 0 ? dailyAll.slice(firstRwaDay) : dailyAll.slice(-14);
  const rwaEstDays = daily.filter((day) => day.est && day.Commodities + day.Stocks > 0).length;

  // Preserve lifetime totals even if the bundled daily series begins after the
  // exchange's first trades: the cumulative lines start from the unobserved
  // offset and end at the same values as the KPI cards.
  let cmdRun = Math.max(0, cumulativeCmd - sum(daily, (day) => day.Commodities));
  let stockRun = Math.max(0, cumulativeStocks - sum(daily, (day) => day.Stocks));
  const cumulative = daily.map((day) => {
    cmdRun += day.Commodities;
    stockRun += day.Stocks;
    return { t: day.t, est: day.est, Commodities: cmdRun, Stocks: stockRun };
  });

  const classStats = (assetClass: Exclude<AssetClass, "Crypto">, rows: MarketRow[], cumulativeVolume: number) => ({
    assetClass,
    rows,
    cumulativeVolume,
    oi: sum(rows, (row) => row.oiUsd),
    volume: sum(rows, (row) => row.volume24h),
  });
  const classes = [
    classStats("Commodities", commodityRows, cumulativeCmd),
    classStats("Stocks", stockRows, cumulativeStocks),
  ];

  const oiClass = classes.map((item) => ({ name: item.assetClass, value: item.oi, color: CLASS_COLOR[item.assetClass] }));
  const volumeClass = classes.map((item) => ({ name: item.assetClass, value: item.volume, color: CLASS_COLOR[item.assetClass] }));
  const oiLegend = oiClass.map((item) => ({ ...item, value: usd(item.value), pct: pct(item.value, rwaOi) }));
  const volumeLegend = volumeClass.map((item) => ({ ...item, value: usd(item.value), pct: pct(item.value, rwaVolume) }));

  return (
    <div className="screen" data-page="rwa" style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      <div className="glass glow-edge grad-frame" style={{ borderRadius: "var(--r-lg)", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, overflow: "hidden" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: CLASS_COLOR.Commodities, fontSize: 10, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase" }}>Real-world assets</div>
          <h1 style={{ margin: "4px 0 0", fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>Commodities + Stocks</h1>
          <p style={{ margin: "5px 0 0", maxWidth: 720, color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55 }}>
            All active RISEx RWA perpetuals: 4 commodity markets and 7 stocks or ETFs. Live metrics refresh from RISEx; history combines Dune with repaired snapshot days.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span className="chip tag-accent"><span className="live-dot"><i className="ping" /><i /></span>{rwaRows.length} / {RWA_SYMBOLS.length} live</span>
          <Link href="/markets" className="chip">All markets →</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 148px), 1fr))", gap: 10, minWidth: 0 }}>
        <Stat big label="Live RWA markets" value={String(rwaRows.length)} color={CLASS_COLOR.Commodities} hint={`${commodityRows.length} commodities · ${stockRows.length} stocks/ETFs`} />
        <Stat big label="RWA open interest" value={usd(rwaOi)} hint={`${pct(rwaOi, totalOi).toFixed(1)}% of total RISEx OI`} />
        <Stat big label="RWA 24h volume" value={usd(rwaVolume)} hint={`${pct(rwaVolume, totalVolume).toFixed(1)}% of total RISEx volume`} />
        <Stat big label="RWA cumulative" value={usd(cumulativeRwa)} color={CLASS_COLOR.Stocks} hint={rwaEstDays ? `Dune + snapshots · ${rwaEstDays} estimated day${rwaEstDays === 1 ? "" : "s"}` : "Dune historical volume"} />
      </div>

      <section>
        <SectionLabel>Class comparison</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14, alignItems: "stretch", minWidth: 0 }}>
          {classes.map((item) => {
            const color = CLASS_COLOR[item.assetClass];
            const expected = item.assetClass === "Commodities" ? CMD_SYMBOLS.length : STOCK_SYMBOLS.length;
            return (
              <Panel key={item.assetClass} pad="16px 17px" style={{ height: "100%", borderTop: `2px solid ${color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: color, boxShadow: `0 0 16px ${color}` }} />
                    <span style={{ fontSize: 16, fontWeight: 750 }}>{item.assetClass}</span>
                  </div>
                  <span className="chip" style={{ color, borderColor: `color-mix(in oklab, ${color} 40%, transparent)` }}>{item.rows.length}/{expected} live</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9 }}>
                  <Metric label="Open interest" value={usd(item.oi)} hint={`${pct(item.oi, rwaOi).toFixed(1)}% of RWA`} color={color} />
                  <Metric label="24h volume" value={usd(item.volume)} hint={`${pct(item.volume, rwaVolume).toFixed(1)}% of RWA`} color={color} />
                  <Metric label="Cumulative" value={usd(item.cumulativeVolume)} hint="Dune + snapshot repair" color={color} />
                  <Metric label="Markets" value={String(item.rows.length)} hint={item.rows.map((row) => row.symbol).join(" · ")} color={color} />
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, alignItems: "stretch", minWidth: 0 }}>
        <ChartCard title="RWA open interest mix" subtitle="Live notional split between commodities and stocks/ETFs" height={270} modalHeight={460} legend={oiLegend} filename="risescreener-rwa-open-interest-mix">
          {rwaOi > 0 ? <Donut data={oiClass} height="100%" /> : <ChartEmpty />}
        </ChartCard>
        <ChartCard title="RWA 24h volume mix" subtitle="Official RISEx 24-hour quote volume by asset class" height={270} modalHeight={460} legend={volumeLegend} filename="risescreener-rwa-volume-mix">
          {rwaVolume > 0 ? <Donut data={volumeClass} height="100%" /> : <ChartEmpty />}
        </ChartCard>
      </div>

      <section>
        <SectionLabel right={<span style={{ color: "var(--muted)", fontSize: 11 }}>Live RISEx · ordered by asset class</span>}>All 11 RWA markets</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 268px), 1fr))", gap: 11, alignItems: "stretch", minWidth: 0 }}>
          {rwaRows.map((row) => <MarketCard key={row.marketId} row={row} totalRwaOi={rwaOi} totalRwaVolume={rwaVolume} />)}
        </div>
        {rwaRows.length !== RWA_SYMBOLS.length && (
          <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid color-mix(in oklab, var(--warn) 35%, transparent)", borderRadius: 8, color: "var(--warn)", fontSize: 11.5 }}>
            Live API coverage is {rwaRows.length}/{RWA_SYMBOLS.length}. Missing markets are not filled with stale or synthetic values.
          </div>
        )}
      </section>

      <section>
        <SectionLabel right={rwaEstDays > 0 ? <span className="chip" style={{ fontSize: 10 }}>◌ estimated days are dimmed</span> : undefined}>RWA volume history</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16, alignItems: "stretch", minWidth: 0 }}>
          <SeriesChart
            title="RWA daily volume"
            subtitle="UTC daily Dune buckets · missing days repaired from near-midnight RISEx snapshots"
            points={daily}
            mode="bars"
            extraKey="cum"
            extraLabel="Cumulative"
            groups={["Commodities", "Stocks"]}
          />
          <SeriesChart
            title="RWA cumulative volume"
            subtitle="Lifetime class totals · Dune history plus explicitly marked snapshot estimates"
            points={cumulative}
            mode="lines"
            extraKey="total"
            extraLabel="RWA total"
            groups={["Commodities", "Stocks"]}
          />
        </div>
      </section>

      <div style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.55 }}>
        Live price, open interest, 24h volume, change and funding come directly from RISEx. Historical days marked <strong style={{ color: "var(--ink)" }}>est.</strong> are reconstructed from the closest periodic live snapshot when Dune omitted or partially wrote that UTC day.
      </div>
    </div>
  );
}

function Metric({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div style={{ minWidth: 0, minHeight: 76, padding: "10px 11px", borderRadius: 8, border: "1px solid var(--hair-soft)", background: "rgba(255,255,255,.018)" }}>
      <div style={{ color: "var(--muted)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</div>
      <div className="tnum" style={{ marginTop: 6, color, fontSize: 17, fontWeight: 750, lineHeight: 1.1 }}>{value}</div>
      <div style={{ marginTop: 5, color: "var(--muted)", fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={hint}>{hint}</div>
    </div>
  );
}

function MarketCard({ row, totalRwaOi, totalRwaVolume }: { row: MarketRow; totalRwaOi: number; totalRwaVolume: number }) {
  const commodity = CMD_SYMBOLS.includes(row.symbol);
  const assetClass = commodity ? "Commodities" : "Stocks";
  const color = RWA_COLORS[row.symbol] ?? CLASS_COLOR[assetClass];
  const changeColor = row.changePct >= 0 ? "var(--long)" : "var(--short)";
  const fundingColor = row.funding8h > 0 ? "var(--long)" : row.funding8h < 0 ? "var(--short)" : "var(--ink)";
  const oiShare = pct(row.oiUsd, totalRwaOi);
  const volumeShare = pct(row.volume24h, totalRwaVolume);
  return (
    <Link
      href={`/markets/${row.marketId}`}
      className="rwa-market-card"
      aria-label={`View ${row.symbol} market details`}
      style={{ display: "block", height: "100%", minWidth: 0, color: "inherit", textDecoration: "none", borderRadius: "var(--r-lg)" }}
    >
      <Panel pad="14px 15px" style={{ height: "100%", display: "flex", flexDirection: "column", gap: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <CoinLogo symbol={row.symbol} size={30} />
          <div style={{ minWidth: 0 }}>
            <span style={{ color: "var(--ink)", fontSize: 14.5, fontWeight: 800 }}>{row.symbol}</span>
            <div style={{ color: "var(--muted)", fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{RWA_NAMES[row.symbol] ?? row.symbol}</div>
          </div>
          <span className="chip" style={{ marginLeft: "auto", color: CLASS_COLOR[assetClass], borderColor: `color-mix(in oklab, ${CLASS_COLOR[assetClass]} 38%, transparent)`, fontSize: 10.5 }}>{commodity ? "Commodity" : "Stock / ETF"}</span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span className="tnum" style={{ color: "var(--ink)", fontSize: 18, fontWeight: 750 }}>${price(row.mark)}</span>
          <span className="tnum" style={{ color: changeColor, fontSize: 12.5, fontWeight: 700 }}>{row.changePct >= 0 ? "+" : ""}{row.changePct.toFixed(2)}%</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px 10px", marginTop: "auto" }}>
          <CardMetric label="Open interest" value={usd(row.oiUsd)} share={oiShare} color={color} />
          <CardMetric label="24h volume" value={usd(row.volume24h)} share={volumeShare} color={color} />
          <CardMetric label="24h change" value={`${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(2)}%`} color={changeColor} />
          <CardMetric label="Funding · 8h" value={`${row.funding8h >= 0 ? "+" : ""}${(row.funding8h * 100).toFixed(4)}%`} hint={`${row.fundingApr >= 0 ? "+" : ""}${row.fundingApr.toFixed(2)}% APR`} color={fundingColor} />
        </div>

        <span className="rwa-market-card-cta" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, color: "var(--muted-2)", fontSize: 10.5, fontWeight: 700 }}>
          View market <span className="rwa-market-card-arrow" aria-hidden="true">↗</span>
        </span>
      </Panel>
    </Link>
  );
}

function CardMetric({ label, value, hint, share, color }: { label: string; value: string; hint?: string; share?: number; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: "var(--muted)", fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</div>
      <div className="tnum" style={{ marginTop: 4, color, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>{value}</div>
      {share != null && (
        <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: "rgba(255,255,255,.07)", overflow: "hidden" }} title={`${share.toFixed(1)}% of RWA`}>
          <span style={{ display: "block", width: `${Math.min(100, share)}%`, height: "100%", borderRadius: 2, background: color }} />
        </div>
      )}
      {hint && <div className="tnum" style={{ marginTop: 3, color: "var(--muted)", fontSize: 10.5 }}>{hint}</div>}
    </div>
  );
}

function ChartEmpty() {
  return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12 }}>Live data is temporarily unavailable.</div>;
}
