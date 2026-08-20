import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarketRows } from "@/lib/analytics";
import { getCandles, getFundingHistory, getDepth } from "@/lib/market-data";
import { usd, price } from "@/lib/format";
import { Stat, UtilBadge } from "@/components/ui";
import { AreaTrend } from "@/components/charts";
import ChartCard from "@/components/ChartCard";
import {
  CandlestickFundingChart,
  BasisOiPriceChart,
  CumulativeDepthChart,
  LiquidityHeatmapChart,
  QuantVizEmptyState,
  SpreadImbalanceDial,
} from "@/components/QuantViz";

const FUNDING_COLOR = "#35c98d";

export const revalidate = 15;

export default async function MarketDetail({ params }: { params: { id: string } }) {
  const rows = await getMarketRows();
  if (!rows.length) {
    return (
      <div className="screen" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Link href="/markets" className="text-muted" style={{ fontSize: 12 }}>← markets</Link>
        <h1 style={{ margin: 0, fontSize: 22 }}>Market data unavailable</h1>
        <QuantVizEmptyState height={280} label="RISEx is temporarily unreachable. This view will retry after the cache window." />
      </div>
    );
  }
  const m = rows.find((r) => r.marketId === params.id);
  if (!m) notFound();

  const [candles, funding, depth] = await Promise.all([
    getCandles(params.id, "5m", 288),
    getFundingHistory(params.id, 96),
    getDepth(params.id, 25),
  ]);
  const orderedCandles = [...candles].sort((a, b) => a.t - b.t);
  const orderedFunding = [...funding].sort((a, b) => a.t - b.t);
  const latestFunding = orderedFunding.at(-1)?.rate;
  const fallbackFundingPct = Number.isFinite(latestFunding)
    ? (latestFunding ?? 0) * 100
    : Number.isFinite(m.funding8h)
      ? m.funding8h * 100
      : 0;
  const candleSeries = orderedCandles.map((candle) => ({
    time: candle.t,
    open: candle.o,
    high: candle.h,
    low: candle.l,
    close: candle.c,
    volume: candle.v,
    fundingRatePct: fundingRateAt(
      candle.t,
      orderedFunding,
      fallbackFundingPct,
    ),
  }));
  const basisOiSeries = orderedCandles.map((candle) => {
    const indexPrice = indexPriceAt(candle.t, orderedFunding, m.index);
    return {
      time: candle.t,
      price: candle.c,
      openInterest: m.oiUsd,
      basisPct: indexPrice > 0 ? ((candle.c - indexPrice) / indexPrice) * 100 : m.basisPct,
    };
  });
  const fundingSeries = orderedFunding.map((f) => ({
    t: f.t,
    r: f.rate * 100,
  }));
  const candleWindowMinutes =
    orderedCandles.length > 1
      ? Math.max(
          1,
          Math.round(
            (orderedCandles[orderedCandles.length - 1].t -
              orderedCandles[0].t) /
              60_000,
          ),
        )
      : null;

  const bestBid = depth.bids.length
    ? Math.max(...depth.bids.map((level) => level.price))
    : 0;
  const bestAsk = depth.asks.length
    ? Math.min(...depth.asks.map((level) => level.price))
    : 0;
  const bookMid =
    bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : m.mark;
  const spreadBps =
    bestBid > 0 && bestAsk > 0 && bookMid > 0
      ? ((bestAsk - bestBid) / bookMid) * 10_000
      : Number.NaN;
  const bidNotional = depth.bids.reduce(
    (sum, level) => sum + Math.max(0, level.price * level.size),
    0,
  );
  const askNotional = depth.asks.reduce(
    (sum, level) => sum + Math.max(0, level.price * level.size),
    0,
  );
  const totalBookNotional = bidNotional + askNotional;
  const imbalance =
    totalBookNotional > 0
      ? (bidNotional - askNotional) / totalBookNotional
      : Number.NaN;
  const snapshotLiquidity = [
    ...depth.bids.map((level) => ({
      time: "Current snapshot",
      price: level.price,
      liquidity: level.price * level.size,
      side: "bid" as const,
    })),
    ...depth.asks.map((level) => ({
      time: "Current snapshot",
      price: level.price,
      liquidity: level.price * level.size,
      side: "ask" as const,
    })),
  ];

  return (
    <div className="screen" data-page="market" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/markets" className="text-muted" style={{ fontSize: 12 }}>← markets</Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{m.symbol}<span className="text-muted" style={{ fontWeight: 400, fontSize: 16 }}>/USDC</span></h1>
        <span className="tnum text-accent" style={{ fontSize: 18, fontWeight: 700 }}>${price(m.mark)}</span>
        <span className="tnum" style={{ color: m.changePct >= 0 ? "var(--long)" : "var(--short)" }}>{m.changePct >= 0 ? "+" : ""}{m.changePct.toFixed(2)}%</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        <Stat label="Open interest" value={usd(m.oiUsd)} />
        <Stat label="OI util" value={<UtilBadge pct={m.oiUtilPct} />} />
        <Stat label="24h volume" value={usd(m.volume24h)} />
        <Stat label="Funding 8h" value={`${(m.funding8h * 100).toFixed(4)}%`} tone={m.funding8h >= 0 ? "long" : "short"} />
        <Stat label="Funding APR" value={`${m.fundingApr >= 0 ? "+" : ""}${m.fundingApr.toFixed(1)}%`} tone={m.fundingApr >= 0 ? "long" : "short"} />
        <Stat label="Basis" value={`${m.basisPct >= 0 ? "+" : ""}${m.basisPct.toFixed(3)}%`} tone={m.basisPct >= 0 ? "long" : "short"} />
        <Stat label="Max leverage" value={`${m.maxLev}×`} />
        <Stat label="24h range" value={`${price(m.low24h)} – ${price(m.high24h)}`} />
      </div>

      <ChartCard
        title="Price · volume · funding"
        subtitle="Official RISEx 5-minute candles · funding uses the latest published observation at each bar"
        height={380}
        modalHeight={520}
        toolbar={<span className="chip">5m{candleWindowMinutes ? ` · ${Math.round(candleWindowMinutes / 60)}h span` : ""}</span>}
        filename={`risescreener-${m.symbol.toLowerCase()}-price`}
      >
        <CandlestickFundingChart
          data={candleSeries}
          height={380}
          fundingLabel="Funding"
          emptyLabel="RISEx candle window unavailable"
        />
      </ChartCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: 16,
        }}
      >
        <ChartCard
          title="Cumulative depth"
          subtitle="Live two-sided order-book snapshot"
          height={300}
          modalHeight={460}
          toolbar={<span className="chip">live snapshot</span>}
          filename={`risescreener-${m.symbol.toLowerCase()}-depth`}
        >
          <CumulativeDepthChart
            bids={depth.bids}
            asks={depth.asks}
            midPrice={bookMid}
            height={300}
            emptyLabel="RISEx order book unavailable"
          />
        </ChartCard>

        <ChartCard
          title="Price-band liquidity"
          subtitle="Current order-book snapshot · not historical liquidity"
          height={300}
          modalHeight={460}
          toolbar={<span className="chip">snapshot</span>}
          filename={`risescreener-${m.symbol.toLowerCase()}-liquidity`}
        >
          <LiquidityHeatmapChart
            data={snapshotLiquidity}
            currentPrice={bookMid}
            height={300}
            emptyLabel="No price-band liquidity in this snapshot"
          />
        </ChartCard>

        <ChartCard
          title="Spread · imbalance"
          subtitle="Bid/ask depth from the current live order book"
          height={300}
          modalHeight={460}
          toolbar={<span className="chip">notional depth</span>}
          filename={`risescreener-${m.symbol.toLowerCase()}-imbalance`}
        >
          {Number.isFinite(spreadBps) && Number.isFinite(imbalance) ? (
            <SpreadImbalanceDial
              spreadBps={spreadBps}
              imbalance={imbalance}
              bidDepth={bidNotional}
              askDepth={askNotional}
              height={300}
              emptyLabel="Two-sided book required for spread analysis"
            />
          ) : (
            <QuantVizEmptyState
              height={300}
              label="Two-sided book required for spread analysis"
            />
          )}
        </ChartCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 410px), 1fr))", gap: 16 }}>
        <ChartCard
          title="Funding rate history"
          subtitle="Published hourly funding observations"
          height={270}
          modalHeight={440}
          toolbar={<span className="chip">hourly</span>}
          filename={`risescreener-${m.symbol.toLowerCase()}-funding`}
        >
          {fundingSeries.length > 1 ? (
            <AreaTrend
              data={fundingSeries}
              xKey="t"
              yKey="r"
              color={FUNDING_COLOR}
              xPreset="datetime"
              height={270}
              valueName="funding"
            />
          ) : (
            <QuantVizEmptyState
              height={270}
              label="Funding history unavailable"
            />
          )}
        </ChartCard>
        <ChartCard
          title="Price · basis · open interest"
          subtitle="Basis tracks each 5-minute close; OI remains the current snapshot"
          height={270}
          modalHeight={440}
          toolbar={<span className="chip">OI snapshot</span>}
          filename={`risescreener-${m.symbol.toLowerCase()}-basis`}
        >
          <BasisOiPriceChart
            data={basisOiSeries}
            height={270}
            emptyLabel="Basis window unavailable"
          />
        </ChartCard>
      </div>
    </div>
  );
}

function fundingRateAt(
  timestamp: number,
  history: { t: number; rate: number }[],
  fallbackPct: number,
) {
  if (!history.length) return fallbackPct;
  let mostRecent: { t: number; rate: number } | undefined;
  for (const point of history) {
    if (point.t <= timestamp) mostRecent = point;
    else break;
  }
  if (mostRecent) return mostRecent.rate * 100;
  const nearest = history.reduce((best, point) =>
    Math.abs(point.t - timestamp) < Math.abs(best.t - timestamp)
      ? point
      : best,
  );
  return nearest.rate * 100;
}

function indexPriceAt(
  timestamp: number,
  history: { t: number; index: number }[],
  fallback: number,
) {
  if (!history.length) return fallback;
  let mostRecent: { t: number; index: number } | undefined;
  for (const point of history) {
    if (point.t <= timestamp && point.index > 0) mostRecent = point;
    else if (point.t > timestamp) break;
  }
  if (mostRecent) return mostRecent.index;
  const valid = history.filter((point) => point.index > 0);
  if (!valid.length) return fallback;
  return valid.reduce((best, point) =>
    Math.abs(point.t - timestamp) < Math.abs(best.t - timestamp)
      ? point
      : best,
  ).index;
}
