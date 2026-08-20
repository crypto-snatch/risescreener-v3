import Link from "next/link";
import { getProtocol, getMarketRows, isUpcoming, type MarketRow } from "@/lib/analytics";
import { getDune } from "@/lib/dune";
import { getGlobalFeed } from "@/lib/risex";
import { getCandles } from "@/lib/market-data";
import { usd, price } from "@/lib/format";
import { Panel } from "@/components/ui";
import ShredPulse from "@/components/ShredPulse";
import { AreaTrend, VolumeChart } from "@/components/charts";
import { Kpi, Treemap, FundingHeatmap, MarketHeatmap, PressureBar, Spark } from "@/components/viz";
import CoinLogo from "@/components/CoinLogo";
import { CorrelationMatrixChart, RealizedVolRankingChart } from "@/components/QuantViz";
import { getAggOiHistory, getPositionsStat } from "@/lib/risescan";
import { isRwa, RWA_COLORS } from "@/lib/sectors";
import type { Candle } from "@/lib/market-data";
import ChartCard from "@/components/ChartCard";
import { getTimeseries } from "@/lib/timeseries";
import { dayTotal, patchVolume } from "@/lib/volume";

export const revalidate = 20;

const OI_COLORS: Record<string, string> = {
  BTC: "#6e74d6", HYPE: "#ff7a4d", ETH: "#9aa3b8", NEAR: "#c77dd6", SOL: "#f5c542",
  ZEC: "#5b8def", BNB: "#f0b90b", XRP: "#7fd6a0", DOGE: "#cdb36a", TAO: "#46c9b0",
};
const FALLBACK = ["#2ee88e", "#7d8cff", "#59c2ff", "#c77dd6", "#f5c542", "#7fd6a0", "#cdb36a"];
const colorOf = (sym: string, i: number) =>
  isRwa(sym) ? (RWA_COLORS[sym] ?? "#e6c069") : (OI_COLORS[sym] ?? FALLBACK[i % FALLBACK.length]);

export default async function Overview() {
  const [p, rows, dune, feed, oiHistory, posStat, timeseries] = await Promise.all([
    getProtocol(),
    getMarketRows(),
    getDune(),
    getGlobalFeed(8).catch(() => []),
    getAggOiHistory(30),
    getPositionsStat(),
    getTimeseries(),
  ]);
  const patchedVolume = patchVolume(dune, timeseries);
  const liqFeesByTime = new Map((dune?.liqFeesByMarket ?? []).map((day) => [day.t, dayTotal(day)]));
  const feesPoints = (dune?.feesByMarket ?? []).slice(-60).map((day) => ({
    t: day.t,
    fees: dayTotal(day) + (liqFeesByTime.get(day.t) ?? 0),
  }));
  const feesTotal = feesPoints.reduce((s, v) => s + v.fees, 0);
  const profitPct = posStat && posStat.accountsTotal > 0 ? (posStat.accountsInProfit / posStat.accountsTotal) * 100 : 0;

  const tradable = rows.filter((r) => !isUpcoming(r));
  const topGainer = [...tradable].sort((a, b) => b.changePct - a.changePct).slice(0, 4);
  const topLoser = [...tradable].sort((a, b) => a.changePct - b.changePct).slice(0, 4);
  const movers = [...topGainer, ...topLoser];

  // Use an explicit 24-hour, 5-minute window for comparable volatility and
  // correlation inputs across the most actively traded markets.
  const quantMarkets = [...tradable]
    .filter((row) => row.mark > 0)
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, 8);
  const candleTargets = [...new Map(
    [...movers, ...quantMarkets]
      .filter((market) => market.mark > 0)
      .map((market) => [market.marketId, market]),
  ).values()];
  const candleSets = await Promise.all(
    candleTargets.map((market) =>
      getCandles(market.marketId, "5m", 288).catch(() => [] as Candle[]),
    ),
  );
  const candlesOf = new Map(candleTargets.map((market, index) => [market.marketId, candleSets[index]]));
  const sparkOf = new Map(movers.map((market) => [market.marketId, (candlesOf.get(market.marketId) ?? []).map((candle) => candle.c)]));

  // Long-horizon flagship series. Volume uses every complete Dune UTC day
  // available (with repaired snapshot gaps). OI uses every stored snapshot and
  // appends the freshest RiseScan hourly observations.
  const HOUR = 3_600_000;
  const volSeries = patchedVolume.volume
    .map((day) => ({ t: day.t, volume: dayTotal(day) }))
    .filter((point) => point.t > 0 && point.volume > 0)
    .sort((left, right) => left.t - right.t);
  const oiByHour = new Map<number, { observedAt: number; totalUsd: number }>();
  const addOi = (observedAt: number, totalUsd: number) => {
    if (!(observedAt > 0) || !(totalUsd > 0)) return;
    const hour = Math.floor(observedAt / HOUR) * HOUR;
    const previous = oiByHour.get(hour);
    if (!previous || observedAt >= previous.observedAt) oiByHour.set(hour, { observedAt, totalUsd });
  };
  for (const point of timeseries) {
    addOi(point.t, Object.values(point.oi ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0));
  }
  for (const point of oiHistory) addOi(point.t, point.totalUsd);
  const oiSeries = [...oiByHour.entries()]
    .map(([t, point]) => ({ t, totalUsd: point.totalUsd }))
    .sort((left, right) => left.t - right.t);
  // Keep both flagship charts on the longest period for which both sources
  // actually contain observations. Volume starts earlier than the OI archive;
  // using the union made the OI chart look broken for that unsupported period.
  const firstVolume = volSeries.at(0)?.t;
  const firstOi = oiSeries.at(0)?.t;
  const lastVolume = volSeries.at(-1)?.t;
  const lastOi = oiSeries.at(-1)?.t;
  const commonStart = firstVolume && firstOi ? Math.max(firstVolume, firstOi) : (firstVolume ?? firstOi);
  const commonEnd = lastVolume && lastOi ? Math.max(lastVolume, lastOi) : (lastVolume ?? lastOi);
  const historyDomain: [number, number] | undefined = commonStart && commonEnd && commonEnd > commonStart
    ? [commonStart, commonEnd]
    : undefined;
  const visibleVolSeries = historyDomain
    ? volSeries.filter((point) => point.t >= historyDomain[0] && point.t <= historyDomain[1])
    : volSeries;
  const visibleOiSeries = historyDomain
    ? oiSeries.filter((point) => point.t >= historyDomain[0] && point.t <= historyDomain[1])
    : oiSeries;
  const sharedTicks = historyDomain
    ? Array.from({ length: 6 }, (_, index) => Math.round(historyDomain[0] + ((historyDomain[1] - historyDomain[0]) * index) / 5))
    : undefined;
  const latestVolume = visibleVolSeries.at(-1)?.volume ?? 0;
  const latestOiHistory = visibleOiSeries.at(-1)?.totalUsd ?? 0;
  const historyRange = historyDomain ? `${dateLabel(historyDomain[0])}–${dateLabel(historyDomain[1])}` : "all available history";

  const volRank = quantMarkets
    .map((market) => ({
      symbol: market.symbol,
      realizedVolPct: realizedVol(candlesOf.get(market.marketId) ?? []),
      changePct: market.changePct,
    }))
    .filter((item) => item.realizedVolPct > 0);

  const correlated = quantMarkets
    .map((market) => ({
      symbol: market.symbol,
      returns: timedReturns(candlesOf.get(market.marketId) ?? []),
    }))
    .filter((item) => item.returns.size >= 8);
  const correlation = correlated.map((left) =>
    correlated.map((right) => pearsonTimed(left.returns, right.returns)),
  );

  // OI treemap slices
  const oiBoxes = [...tradable]
    .filter((r) => r.oiUsd > 0)
    .sort((a, b) => b.oiUsd - a.oiUsd)
    .slice(0, 10)
    .map((r, i) => ({ name: r.symbol, value: r.oiUsd, color: colorOf(r.symbol, i) }));

  // funding heatmap cells (sorted by magnitude)
  const fundingCells = [...tradable]
    .sort((a, b) => Math.abs(b.fundingApr) - Math.abs(a.fundingApr))
    .slice(0, 18)
    .map((r) => ({ symbol: r.symbol, apr: r.fundingApr }));

  // market heatmap — box size = 24h volume, colour = 24h change
  const heatMarkets = tradable.filter((r) => r.volume24h > 0).map((r) => ({ symbol: r.symbol, volume: r.volume24h, change: r.changePct }));

  // taker flow from the live feed (real buy vs sell notional)
  const buyFlow = feed.filter((t) => t.side === "BUY").reduce((s, t) => s + t.notional, 0);
  const sellFlow = feed.filter((t) => t.side === "SELL").reduce((s, t) => s + t.notional, 0);

  const tvlPoints = (dune?.tvl ?? []).map((x) => ({ t: x.t, tvl: x.tvl }));

  return (
    <div className="screen" data-page="overview" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── hero band ── */}
      <div className="glass glow-edge grad-frame" style={{ borderRadius: "var(--r-lg)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-.02em" }}>
              <span className="grad-text">RISE</span> Overview
            </h1>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>The trading chain — live markets, open interest, funding & flow.</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span className="chip tag-accent" style={{ fontSize: 11 }}><span className="live-dot"><i className="ping" /><i /></span> {p.listedMarkets} live markets</span>
            <Link href="/markets" className="chip" style={{ fontSize: 11 }}>All markets →</Link>
          </div>
        </div>
      </div>

      {/* ── animated KPI grid ── */}
      <div className="reveal" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
        <Kpi label="TVL" value={dune?.totals.tvl ?? p.tvl} accent />
        <Kpi label="Open interest" value={p.totalOiUsd} hint="live RISEx books" />
        <Kpi label="24h volume" value={p.totalVolume24h} />
        <Kpi label="Cumulative volume" value={patchedVolume.cumVolume} accent hint={patchedVolume.estDays ? `${patchedVolume.estDays} missing Dune day${patchedVolume.estDays === 1 ? "" : "s"} rebuilt from snapshots` : "Dune historical total"} />
        <Kpi label="Total fees" value={dune?.totals.cumFees ?? 0} />
        <Kpi label="Accounts" value={dune?.totals.accounts ?? p.wallets.total} format="int" />
      </div>

      {/* ── flagship: synchronized full-history volume + total open interest ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))", gap: 16 }}>
        <ChartCard
          title="Exchange volume history"
          subtitle={`Daily Dune history · longest period shared with OI · ${historyRange}`}
          height={264}
          modalHeight={460}
          toolbar={latestVolume > 0 ? <span className="tnum text-accent" style={{ fontSize: 11.5, fontWeight: 700 }}>{usd(latestVolume)} <span className="text-muted">latest · {visibleVolSeries.length}d</span></span> : undefined}
          filename="risescreener-exchange-volume"
        >
          {visibleVolSeries.length > 1 ? <VolumeChart data={visibleVolSeries} height={264} xPreset="date" xTicks={sharedTicks} xDomain={historyDomain} /> : <div style={{ height: 264 }}><Empty /></div>}
        </ChartCard>
        <ChartCard
          title="Total open interest history"
          subtitle={`Stored all-market OI + recent API samples · one point per UTC hour · ${historyRange}`}
          height={264}
          modalHeight={460}
          toolbar={latestOiHistory > 0 ? <span className="tnum text-accent" style={{ fontSize: 11.5, fontWeight: 700 }}>{usd(latestOiHistory)}</span> : undefined}
          filename="risescreener-open-interest-history"
        >
          {visibleOiSeries.length > 1 ? <AreaTrend data={visibleOiSeries} xKey="t" yKey="totalUsd" color="#59c2ff" xPreset="date" yPreset="usd" valueName="Total OI" height={264} xTicks={sharedTicks} xDomain={historyDomain} /> : <div style={{ height: 264 }}><Empty /></div>}
        </ChartCard>
      </div>

      {/* ── OI map + funding heatmap ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px,1fr))", gap: 16 }}>
        <ChartCard
          title="Open interest leaders"
          subtitle="Equal aligned tiles · bar length shows relative live notional"
          height={300}
          modalHeight={440}
          toolbar={<span className="tnum text-accent" style={{ fontSize: 11.5, fontWeight: 700 }}>{usd(p.totalOiUsd)}</span>}
          filename="risescreener-open-interest-leaders"
        >
          {oiBoxes.length ? <Treemap items={oiBoxes} height={300} /> : <Empty />}
        </ChartCard>
        <ChartCard
          title="Funding heatmap"
          subtitle="Annualized current funding · green = longs pay, red = shorts pay"
          height={300}
          modalHeight={440}
          toolbar={<Link href="/funding" className="chip" style={{ fontSize: 10.5 }}>Funding →</Link>}
          filename="risescreener-funding-heatmap"
        >
          {fundingCells.length ? <FundingHeatmap cells={fundingCells} /> : <Empty />}
        </ChartCard>
      </div>

      {/* ── market heatmap ── */}
      <ChartCard
        title="Market heatmap"
        subtitle="Ranked by official 24h quote volume · colour = official 24h price change"
        height={260}
        modalHeight={460}
        filename="risescreener-market-heatmap"
      >
        {heatMarkets.length ? <MarketHeatmap items={heatMarkets} height={260} /> : <Empty />}
      </ChartCard>

      {/* ── short-horizon risk atlas ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))", gap: 16 }}>
        <ChartCard
          title="Realized volatility"
          subtitle="24-hour 5-minute log returns · annualized · top markets by volume"
          height={300}
          modalHeight={460}
          filename="risescreener-realized-volatility"
        >
          <RealizedVolRankingChart data={volRank} height={300} />
        </ChartCard>
        <ChartCard
          title="Return correlation"
          subtitle="24-hour window · synchronized 5-minute log returns"
          height={300}
          modalHeight={500}
          filename="risescreener-return-correlation"
        >
          <CorrelationMatrixChart symbols={correlated.map((item) => item.symbol)} values={correlation} height={300} />
        </ChartCard>
      </div>

      {/* ── protocol fees + trader profitability (RISEx Analytics API) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}>
        <ChartCard
          title="Protocol fees"
          subtitle="Complete UTC-day trading + liquidation fees · Dune refreshes daily"
          height={244}
          modalHeight={440}
          toolbar={feesTotal > 0 ? <span className="tnum text-accent" style={{ fontSize: 11.5, fontWeight: 700 }}>{usd(feesTotal)} <span className="text-muted">{feesPoints.length}d</span></span> : undefined}
          filename="risescreener-protocol-fees"
        >
          {feesPoints.length > 1 ? <AreaTrend data={feesPoints} xKey="t" yKey="fees" xPreset="date" yPreset="usd" valueName="Fees" height={244} /> : <div style={{ height: 244 }}><Empty /></div>}
        </ChartCard>
        <ChartCard
          title="Trader profitability"
          subtitle="Current account profitability and long/short open interest"
          height={244}
          modalHeight={420}
          toolbar={posStat ? <span className="tnum" style={{ fontSize: 12, color: profitPct >= 50 ? "var(--long)" : "var(--short)", fontWeight: 700 }}>{profitPct.toFixed(1)}%</span> : undefined}
          filename="risescreener-trader-profitability"
        >
          {posStat ? (
            <div style={{ display: "flex", height: "100%", flexDirection: "column", gap: 16, paddingTop: 4 }}>
              <PressureBar left={posStat.accountsInProfit} right={Math.max(0, posStat.accountsTotal - posStat.accountsInProfit)} leftLabel="In profit" rightLabel="At loss" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <MiniStat label="Long OI" value={usd(posStat.longOiUsd)} color="var(--long)" />
                <MiniStat label="Short OI" value={usd(posStat.shortOiUsd)} color="var(--short)" />
                <MiniStat label="Open longs" value={posStat.numLongs.toLocaleString()} color="var(--ink)" />
                <MiniStat label="Open shorts" value={posStat.numShorts.toLocaleString()} color="var(--ink)" />
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-2)", lineHeight: 1.55 }}>{posStat.accountsInProfit.toLocaleString()} of {posStat.accountsTotal.toLocaleString()} accounts in profit · total equity {usd(posStat.totalEquity)}.</div>
            </div>
          ) : <div style={{ height: 244 }}><Empty /></div>}
        </ChartCard>
      </div>

      {/* ── TVL trend + taker flow ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}>
        <ChartCard
          title="TVL"
          subtitle="Historical collateral snapshots · Dune refreshes daily"
          height={250}
          modalHeight={440}
          filename="risescreener-tvl"
        >
          {tvlPoints.length > 1 ? (
            <AreaTrend data={tvlPoints} xKey="t" yKey="tvl" xPreset="date" yPreset="usd" valueName="TVL" height={250} />
          ) : <div style={{ height: 250 }}><Empty /></div>}
        </ChartCard>
        <ChartCard
          title="Taker flow"
          subtitle="Buy versus sell notional in the latest cross-market trades"
          height={250}
          modalHeight={420}
          toolbar={<Link href="/liquidations" className="chip" style={{ fontSize: 10.5 }}>Liquidations →</Link>}
          filename="risescreener-taker-flow"
        >
          <div style={{ display: "flex", height: "100%", flexDirection: "column", gap: 18, paddingTop: 6 }}>
            <PressureBar left={buyFlow} right={sellFlow} leftLabel="Buy" rightLabel="Sell" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <MiniStat label="Buy notional" value={usd(buyFlow)} color="var(--long)" />
              <MiniStat label="Sell notional" value={usd(sellFlow)} color="var(--short)" />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-2)", lineHeight: 1.55 }}>Aggregated from the live cross-market trade feed. Real-time taker pressure across all RISEx markets.</div>
          </div>
        </ChartCard>
      </div>

      {/* ── live chain ── */}
      <ShredPulse />

      {/* ── movers with real sparklines ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 16 }}>
        <MoverCard title="Top gainers · 24h" rows={topGainer} sparkOf={sparkOf} />
        <MoverCard title="Top losers · 24h" rows={topLoser} sparkOf={sparkOf} />
      </div>
    </div>
  );
}

function logReturns(candles: Candle[]): number[] {
  const returns: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1].c;
    const current = candles[index].c;
    if (previous > 0 && current > 0) returns.push(Math.log(current / previous));
  }
  return returns;
}

function timedReturns(candles: Candle[]): Map<number, number> {
  const returns = new Map<number, number>();
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1].c;
    const current = candles[index].c;
    if (previous > 0 && current > 0) {
      const bucket = Math.floor(candles[index].t / 300_000) * 300_000;
      returns.set(bucket, Math.log(current / previous));
    }
  }
  return returns;
}

function realizedVol(candles: Candle[]): number {
  const returns = logReturns(candles);
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const intervals = candles
    .slice(1)
    .map((candle, index) => candle.t - candles[index].t)
    .filter((delta) => delta > 0)
    .sort((a, b) => a - b);
  const intervalMinutes = intervals.length
    ? Math.max(1, intervals[Math.floor(intervals.length / 2)] / 60_000)
    : 5;
  const periodsPerYear = (365 * 24 * 60) / intervalMinutes;
  return Math.sqrt(Math.max(0, variance)) * Math.sqrt(periodsPerYear) * 100;
}

function pearsonTimed(left: Map<number, number>, right: Map<number, number>): number {
  const shared = [...left.keys()].filter((timestamp) => right.has(timestamp)).sort((a, b) => a - b);
  if (shared.length < 2) return 0;
  const a = shared.map((timestamp) => left.get(timestamp) ?? 0);
  const b = shared.map((timestamp) => right.get(timestamp) ?? 0);
  const count = shared.length;
  const meanA = a.reduce((sum, value) => sum + value, 0) / count;
  const meanB = b.reduce((sum, value) => sum + value, 0) / count;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let index = 0; index < count; index += 1) {
    const da = a[index] - meanA;
    const db = b[index] - meanB;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }
  const denominator = Math.sqrt(varianceA * varianceB);
  return denominator > 0 ? Math.max(-1, Math.min(1, covariance / denominator)) : 0;
}

function Empty() {
  return <div style={{ height: "100%", minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-2)", fontSize: 12 }}>no data</div>;
}

function dateLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass" style={{ padding: "10px 12px", borderRadius: 9 }}>
      <div style={{ fontSize: 10.5, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function MoverCard({ title, rows, sparkOf }: { title: string; rows: MarketRow[]; sparkOf: Map<string, number[]> }) {
  return (
    <Panel>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hair)", fontWeight: 800, fontSize: 13 }}>{title}</div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {rows.map((r) => {
          const up = r.changePct >= 0;
          const col = up ? "var(--long)" : "var(--short)";
          const data = sparkOf.get(r.marketId) ?? [];
          return (
            <li key={r.marketId} className="row" style={{ gridTemplateColumns: "1fr 92px auto", display: "grid", alignItems: "center" }}>
              <Link href={`/markets/${r.marketId}`} className="mono-link" style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 9 }}>
                <CoinLogo symbol={r.symbol} size={20} />
                {r.symbol} <span className="text-muted" style={{ fontWeight: 400, fontSize: 11.5 }}>${price(r.mark)}</span>
              </Link>
              <Spark data={data} color={up ? "#35c98d" : "#e46a7b"} />
              <span className="tnum" style={{ color: col, fontWeight: 700, minWidth: 66, textAlign: "right" }}>{up ? "+" : ""}{r.changePct.toFixed(2)}%</span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
