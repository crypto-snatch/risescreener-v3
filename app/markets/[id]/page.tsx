import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarketRows } from "@/lib/analytics";
import { getCandles, getFundingHistory, getDepth } from "@/lib/market-data";
import { usd, price, compact } from "@/lib/format";
import { Panel, Stat, SectionLabel, UtilBadge } from "@/components/ui";
import { AreaTrend } from "@/components/charts";

const FUNDING_COLOR = "#45e0a0";

export const revalidate = 15;

export default async function MarketDetail({ params }: { params: { id: string } }) {
  const rows = await getMarketRows();
  const m = rows.find((r) => r.marketId === params.id);
  if (!m) notFound();

  const [candles, funding, depth] = await Promise.all([
    getCandles(params.id, "60", 168),
    getFundingHistory(params.id, 96),
    getDepth(params.id, 15),
  ]);
  const priceSeries = candles.map((k) => ({ t: k.t, c: k.c }));
  const fundingSeries = funding.map((f) => ({ t: f.t, r: f.rate * 100 }));

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

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 16 }}>
        <Panel pad="14px 16px">
          <SectionLabel right={<span className="chip">1h · 7d</span>}>Price</SectionLabel>
          {priceSeries.length > 1 ? <AreaTrend data={priceSeries} xKey="t" yKey="c" xPreset="datetime" /> : <Empty />}
        </Panel>
        <Panel pad="14px 16px">
          <SectionLabel>Order book depth</SectionLabel>
          <Depth bids={depth.bids} asks={depth.asks} />
        </Panel>
      </div>

      <Panel pad="14px 16px">
        <SectionLabel>Funding rate history</SectionLabel>
        {fundingSeries.length > 1 ? <AreaTrend data={fundingSeries} xKey="t" yKey="r" color={FUNDING_COLOR} xPreset="datetime" height={200} /> : <Empty />}
      </Panel>
    </div>
  );
}

function Depth({ bids, asks }: { bids: { price: number; size: number }[]; asks: { price: number; size: number }[] }) {
  const Row = ({ p, s, side }: { p: number; s: number; side: "bid" | "ask" }) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "2px 0", fontVariantNumeric: "tabular-nums" }}>
      <span style={{ color: side === "bid" ? "var(--long)" : "var(--short)" }}>${price(p)}</span>
      <span className="text-muted">{compact(s)}</span>
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>{bids.map((b, i) => <Row key={i} p={b.price} s={b.size} side="bid" />)}</div>
      <div>{asks.map((a, i) => <Row key={i} p={a.price} s={a.size} side="ask" />)}</div>
    </div>
  );
}
function Empty() {
  return <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>no data</div>;
}
