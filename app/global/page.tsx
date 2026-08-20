import { getGlobalStats, getFearGreed, getTrending, getTopCoins, getChainTvls, getCoinPriceHistory, getHistoricalChainTvl, type Coin } from "@/lib/market-global";
import { usd, price } from "@/lib/format";
import { Panel, Stat } from "@/components/ui";
import RemoteMark from "@/components/RemoteMark";
import { AreaTrend } from "@/components/charts";
import ChartCard from "@/components/ChartCard";

export const revalidate = 300;
export const metadata = { title: "Global market — crypto context | RiseScreener" };

function pctTone(n: number) {
  return n >= 0 ? "var(--long)" : "var(--short)";
}
function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

// Fear & Greed semicircle gauge (pure SVG, server-rendered).
function Gauge({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  const a = Math.PI * (1 - v / 100); // angle from left(π)→right(0)
  const cx = 90, cy = 90, r = 72;
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  const color = v < 25 ? "#e8737f" : v < 45 ? "#e6a05a" : v < 55 ? "#e6c069" : v < 75 ? "#7fd6a0" : "#34cfa2";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox="0 0 180 108" width="180" height="108" aria-hidden>
        <path d="M18 90 A72 72 0 0 1 162 90" fill="none" stroke="var(--hair)" strokeWidth="12" strokeLinecap="round" />
        <path d={`M18 90 A72 72 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
        <circle cx={x} cy={y} r="6" fill={color} />
      </svg>
      <div className="tnum" style={{ fontSize: 30, fontWeight: 800, color, marginTop: -12, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function CoinRow({ c, i }: { c: Coin; i?: number }) {
  return (
    <li className="row" style={{ gridTemplateColumns: i != null ? "18px 24px 1fr auto" : "24px 1fr auto", display: "grid" }}>
      {i != null && <span className="text-muted" style={{ fontSize: 11 }}>{i + 1}</span>}
      <RemoteMark src={c.image} label={c.symbol} size={18} />
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <b style={{ fontWeight: 700 }}>{c.symbol}</b>
        <span className="text-muted" style={{ marginLeft: 7, fontSize: 11.5 }}>{c.name}</span>
      </span>
      <span className="tnum" style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        {c.price != null && <span className="text-muted" style={{ fontSize: 11.5 }}>${price(c.price)}</span>}
        <span style={{ color: pctTone(c.change24h), minWidth: 58, textAlign: "right" }}>{pct(c.change24h)}</span>
      </span>
    </li>
  );
}

export default async function GlobalPage() {
  const [g, fng, trending, top, chainData, btcHistory, riseTvlHistory] = await Promise.all([
    getGlobalStats(),
    getFearGreed(),
    getTrending(),
    getTopCoins(),
    getChainTvls(),
    getCoinPriceHistory("bitcoin", 30),
    getHistoricalChainTvl("Rise"),
  ]);
  const { chains, totalDefiTvl, riseRank } = chainData;
  const maxTvl = chains.length ? chains[0].tvl : 1;

  return (
    <div className="screen" data-page="global" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Global market</h1>
        <p style={{ margin: "7px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Where RISE sits in the broader market — total cap, dominance, sentiment and chain-TVL context. Free public data.
        </p>
      </div>

      {g ? (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))" }}>
          <Stat big label="Total market cap" value={usd(g.totalMcap)} tone="accent" hint={`${pct(g.mcapChange24h)} 24h`} />
          <Stat big label="24h volume" value={usd(g.totalVol)} />
          <Stat big label="BTC dominance" value={`${g.btcDom.toFixed(1)}%`} />
          <Stat big label="ETH dominance" value={`${g.ethDom.toFixed(1)}%`} />
          <Stat big label="Active coins" value={g.activeCoins.toLocaleString()} hint={`${g.markets.toLocaleString()} markets`} />
        </div>
      ) : (
        <Panel pad="16px"><span style={{ color: "var(--muted)", fontSize: 12 }}>Global stats unavailable (provider rate-limited). Refresh shortly.</span></Panel>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 390px),1fr))", gap: 16 }}>
        <ChartCard
          title="BTC market regime"
          subtitle="30-day reference price · CoinGecko"
          height={250}
          modalHeight={440}
          toolbar={<span className="chip">30D</span>}
          filename="risescreener-btc-regime"
        >
          {btcHistory.length > 1 ? (
            <AreaTrend
              data={btcHistory.map((point) => ({ t: point.t, price: point.value }))}
              xKey="t"
              yKey="price"
              xPreset="date"
              yPreset="usd"
              valueName="BTC"
              height={250}
            />
          ) : <HistoryEmpty label="BTC history rate-limited" />}
        </ChartCard>
        <ChartCard
          title="RISE chain TVL"
          subtitle="Historical chain liquidity · DefiLlama"
          height={250}
          modalHeight={440}
          toolbar={<span className="chip">120D</span>}
          filename="risescreener-rise-tvl"
        >
          {riseTvlHistory.length > 1 ? (
            <AreaTrend
              data={riseTvlHistory.map((point) => ({ t: point.t, tvl: point.value }))}
              xKey="t"
              yKey="tvl"
              xPreset="date"
              yPreset="usd"
              valueName="TVL"
              height={250}
            />
          ) : <HistoryEmpty label="RISE history not indexed yet" />}
        </ChartCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16, alignItems: "start" }}>
        {/* chain TVL leaderboard */}
        <Panel>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hair)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Chain TVL leaderboard</span>
            <span className="text-muted" style={{ fontSize: 11 }}>DeFi total {usd(totalDefiTvl)}</span>
          </div>
          {chains.length === 0 ? (
            <div style={{ padding: 24, color: "var(--muted)", fontSize: 12, textAlign: "center" }}>Unavailable — refresh shortly.</div>
          ) : (
            <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
              {chains.map((c, i) => {
                const rank = c.rank ?? i + 1; // pinned RISE row carries its true global rank
                const pinned = c.rank != null;
                return (
                  <div key={c.name} style={{ display: "grid", gridTemplateColumns: "26px 96px 1fr auto", gap: 10, alignItems: "center", fontSize: 12, ...(pinned ? { marginTop: 4, paddingTop: 9, borderTop: "1px dashed var(--hair)" } : {}) }}>
                    <span className="text-muted tnum" style={{ fontSize: 10.5 }}>{rank}</span>
                    <span style={{ fontWeight: c.isRise ? 800 : 600, color: c.isRise ? "var(--accent-ink)" : "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}{c.isRise && " ◂"}</span>
                    <span style={{ height: 7, background: "var(--hair)", borderRadius: 3, overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${Math.max(2, (c.tvl / maxTvl) * 100)}%`, background: c.isRise ? "var(--accent)" : "var(--accent-2)", opacity: c.isRise ? 1 : 0.7 }} />
                    </span>
                    <span className="tnum text-muted" style={{ minWidth: 52, textAlign: "right" }}>{usd(c.tvl)}</span>
                  </div>
                );
              })}
              {riseRank == null && (
                <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 4 }}>RISE not yet ranked on DefiLlama — track its TVL on the Overview & Flows pages.</div>
              )}
            </div>
          )}
        </Panel>

        {/* sentiment + trending */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ChartCard
            title="Fear & Greed"
            subtitle="Broad crypto-market sentiment · alternative.me"
            height={180}
            modalHeight={360}
            filename="risescreener-fear-greed"
          >
            <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
              {fng ? <Gauge value={fng.value} label={fng.label} /> : <div style={{ color: "var(--muted)", fontSize: 12, padding: "20px 0", textAlign: "center" }}>Unavailable</div>}
            </div>
          </ChartCard>
          <Panel>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hair)", fontWeight: 700, fontSize: 13 }}>Trending</div>
            {trending.length === 0 ? (
              <div style={{ padding: 20, color: "var(--muted)", fontSize: 12, textAlign: "center" }}>Unavailable</div>
            ) : (
              <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {trending.map((c) => <CoinRow key={c.id} c={c} />)}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      {/* top coins */}
      <Panel>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hair)", fontWeight: 700, fontSize: 13 }}>Top assets by market cap</div>
        {top.length === 0 ? (
          <div style={{ padding: 24, color: "var(--muted)", fontSize: 12, textAlign: "center" }}>Unavailable — refresh shortly.</div>
        ) : (
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {top.map((c, i) => <CoinRow key={c.id} c={c} i={i} />)}
          </ol>
        )}
      </Panel>

      <div style={{ fontSize: 11, color: "var(--muted-2)", lineHeight: 1.6 }}>
        Market data from CoinGecko, DefiLlama &amp; alternative.me — free public APIs, cached ~5 min. Broad-market context only, not RISEx data.
      </div>
    </div>
  );
}

function HistoryEmpty({ label }: { label: string }) {
  return (
    <div style={{ height: 250, display: "grid", placeItems: "center", border: "1px solid var(--hair-soft)", borderRadius: 7, color: "var(--muted-2)", fontSize: 11 }}>
      {label}
    </div>
  );
}
