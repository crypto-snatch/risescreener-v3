import Link from "next/link";
import { getProtocol, getMarketRows, isUpcoming, type MarketRow } from "@/lib/analytics";
import { getDune } from "@/lib/dune";
import { usd, compact, price } from "@/lib/format";
import { Panel, Stat } from "@/components/ui";
import ShredPulse from "@/components/ShredPulse";
import SeriesChart from "@/components/SeriesChart";
import { AreaTrend } from "@/components/charts";
import OiDonut from "@/components/OiDonut";
import { isRwa, RWA_COLORS } from "@/lib/sectors";

export const revalidate = 20;

const OI_COLORS: Record<string, string> = {
  BTC: "#6e74d6", HYPE: "#ff7a4d", ETH: "#9aa3b8", NEAR: "#c77dd6", SOL: "#f5c542",
  ZEC: "#5b8def", BNB: "#f0b90b", XRP: "#7fd6a0", DOGE: "#cdb36a", TAO: "#46c9b0",
};
// crypto slice fallbacks for markets not in OI_COLORS
const CRYPTO_FALLBACK = ["#6e857e", "#5b8def", "#c77dd6", "#46c9b0", "#cdb36a", "#7fd6a0"];
// Cum Vol stacked bands: crypto coins + an RWA (metals) band
const VOL_GROUPS = ["BTC", "ETH", "SOL", "HYPE", "RWA", "Others"];

export default async function Overview() {
  const [p, rows, dune] = await Promise.all([getProtocol(), getMarketRows(), getDune()]);

  const tradable = rows.filter((r) => !isUpcoming(r));
  const topOI = [...rows].sort((a, b) => b.oiUsd - a.oiUsd).slice(0, 5);
  const topVol = [...rows].sort((a, b) => b.volume24h - a.volume24h).slice(0, 5);
  const topGainer = [...tradable].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const topLoser = [...tradable].sort((a, b) => a.changePct - b.changePct).slice(0, 5);
  const pct = (r: MarketRow) => `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`;

  // ── asset-class split (live, per-market): Crypto vs RWA (gold/silver) ──
  const sum = (arr: MarketRow[], f: (r: MarketRow) => number) => arr.reduce((s, r) => s + f(r), 0);
  const rwaRows = tradable.filter((r) => isRwa(r.symbol));
  const cryptoRows = tradable.filter((r) => !isRwa(r.symbol));
  const oiRwa = sum(rwaRows, (r) => r.oiUsd);
  const oiCrypto = sum(cryptoRows, (r) => r.oiUsd);
  const oiLive = oiRwa + oiCrypto;
  const vol24Rwa = sum(rwaRows, (r) => r.volume24h);
  const vol24Crypto = sum(cryptoRows, (r) => r.volume24h);
  const cumRwa = dune?.totals.cumVolumeRwa;
  const cumCrypto = dune?.totals.cumVolumeCrypto;
  const splitHint = (a: number, b: number) => `Crypto ${usd(a)} · RWA ${usd(b)}`;

  const volPoints = dune?.volume ?? [];
  const tvlPoints = (dune?.tvl ?? []).map((x) => ({ t: x.t, tvl: x.tvl }));
  // OI donut from live rows, grouped by asset class: crypto first, RWA (gold/silver) clustered at the end.
  let cf = 0;
  const oiDonut = [...tradable]
    .filter((r) => r.oiUsd > 0)
    .sort((a, b) => {
      const ca = isRwa(a.symbol) ? 1 : 0, cb = isRwa(b.symbol) ? 1 : 0;
      return ca !== cb ? ca - cb : b.oiUsd - a.oiUsd;
    })
    .map((r) => ({
      name: r.symbol,
      value: r.oiUsd,
      color: isRwa(r.symbol)
        ? (RWA_COLORS[r.symbol] ?? "#e6c069")
        : (OI_COLORS[r.symbol] ?? CRYPTO_FALLBACK[cf++ % CRYPTO_FALLBACK.length]),
    }));

  return (
    <div className="screen" data-page="overview" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Overview</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
        <Stat big label="TVL" value={usd(dune?.totals.tvl ?? p.tvl)} tone="accent" />
        <Stat big label="Total open interest" value={usd(dune?.totals.oi ?? p.totalOiUsd)} hint={splitHint(oiCrypto, oiRwa)} />
        <Stat big label="OI · Crypto" value={usd(oiCrypto)} hint={oiLive > 0 ? `${((oiCrypto / oiLive) * 100).toFixed(1)}% of OI` : undefined} />
        <Stat big label="OI · RWA" value={usd(oiRwa)} hint={oiLive > 0 ? `${((oiRwa / oiLive) * 100).toFixed(1)}% · gold + silver` : "gold + silver"} />
        <Stat big label="24h volume" value={usd(p.totalVolume24h)} hint={splitHint(vol24Crypto, vol24Rwa)} />
        <Stat big label="Cumulative volume" value={usd(dune?.totals.cumVolume ?? 0)} tone="accent" />
        <Stat big label="Cum Vol · Crypto" value={cumCrypto != null ? usd(cumCrypto) : "—"} hint={cumCrypto == null ? "pending data refresh" : undefined} />
        <Stat big label="Cum Vol · RWA" value={cumRwa != null ? usd(cumRwa) : "—"} hint={cumRwa == null ? "pending data refresh" : "gold + silver"} />
        <Stat big label="Total fees" value={usd(dune?.totals.cumFees ?? 0)} />
        <Stat big label="Accounts" value={compact(dune?.totals.accounts ?? p.wallets.total)} />
        <Stat big label="Listed markets" value={String(p.listedMarkets)} />
        <Stat big label="Upcoming markets" value={String(p.upcomingMarkets)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px,1fr))", gap: 16 }}>
        <SeriesChart title="Cum Vol" points={volPoints} mode="bars" extraKey="cum" extraLabel="Cumulative" groups={VOL_GROUPS} />
        <Panel pad="14px 16px">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>OI</div>
            <div style={{ display: "flex", gap: 12, fontSize: 10.5, color: "var(--muted-2)" }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#34cfa2", marginRight: 5 }} />Crypto</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#e6c069", marginRight: 5 }} />RWA</span>
            </div>
          </div>
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
