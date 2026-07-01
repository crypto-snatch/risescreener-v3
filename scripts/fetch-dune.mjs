// Pulls RISEx historical data from the public Dune dashboard
// (dune.com/rise_foundation/risex) and writes a compact data/dune.json the app
// reads. RISEx's own API has no history; Dune does. Run on a cron.
//   DUNE_API_KEY=xxx node scripts/fetch-dune.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "dune.json");
const KEY = process.env.DUNE_API_KEY;
if (!KEY) {
  console.error("Missing DUNE_API_KEY env");
  process.exit(1);
}

const Q = {
  volumeByMarket: 6944583,
  tvlDaily: 6940251,
  protocolDaily: 6944629,
  accountsDaily: 6947001,
  oiNow: 6949630,
  liqTotals: 6949906,
};
const GROUPS = ["BTC", "ETH", "SOL", "HYPE"];
const sym = (name) => (name || "").replace("/USDC", "");

async function rows(id, limit = 2000) {
  const r = await fetch(`https://api.dune.com/api/v1/query/${id}/results?limit=${limit}`, {
    headers: { "X-Dune-Api-Key": KEY },
  });
  if (!r.ok) throw new Error(`dune q${id} -> ${r.status}`);
  const j = await r.json();
  return j.result?.rows ?? [];
}
const dayMs = (s) => new Date(String(s).replace(" ", "T") + "Z").getTime();

async function main() {
  const [vbm, tvl, proto, accts, oi, liq] = await Promise.all([
    rows(Q.volumeByMarket),
    rows(Q.tvlDaily),
    rows(Q.protocolDaily),
    rows(Q.accountsDaily),
    rows(Q.oiNow),
    rows(Q.liqTotals),
  ]);

  // volume / fees / liq-fees by market → per-day { BTC, ETH, SOL, HYPE, Others }
  const blank = (t) => ({ t, BTC: 0, ETH: 0, SOL: 0, HYPE: 0, Others: 0 });
  const byDay = new Map();
  const feeDay = new Map();
  const liqFeeDay = new Map();
  for (const r of vbm) {
    const t = dayMs(r.period);
    const g = GROUPS.includes(sym(r.market_name)) ? sym(r.market_name) : "Others";
    if (!byDay.has(t)) byDay.set(t, blank(t));
    if (!feeDay.has(t)) feeDay.set(t, blank(t));
    if (!liqFeeDay.has(t)) liqFeeDay.set(t, blank(t));
    byDay.get(t)[g] += Math.round(r.daily_volume_usd || 0);
    feeDay.get(t)[g] += Math.round(r.daily_total_fees_usd || 0);
    liqFeeDay.get(t)[g] += Math.round(r.daily_liquidation_fees_usd || 0);
  }
  const volume = [...byDay.values()].sort((a, b) => a.t - b.t);
  const feesByMarket = [...feeDay.values()].sort((a, b) => a.t - b.t);
  const liqFeesByMarket = [...liqFeeDay.values()].sort((a, b) => a.t - b.t);

  const tvlSeries = tvl
    .map((r) => ({ t: dayMs(r.day), tvl: Math.round(r.cumulative_tvl || 0), deposits: Math.round(r.deposits || 0), withdrawals: Math.round(r.withdrawals || 0), net: Math.round(r.net_flow || 0) }))
    .sort((a, b) => a.t - b.t);

  const accountsSeries = accts
    .map((r) => ({ t: dayMs(r.period), newAccounts: r.new_accounts || 0, activeTraders: r.active_traders || 0, cumAccounts: r.cumulative_accounts || 0 }))
    .sort((a, b) => a.t - b.t);

  const protoSorted = [...proto].sort((a, b) => dayMs(a.day) - dayMs(b.day));
  const latest = protoSorted[protoSorted.length - 1] || {};
  const latestTvl = tvlSeries[tvlSeries.length - 1]?.tvl ?? 0;
  const latestAccts = accountsSeries[accountsSeries.length - 1]?.cumAccounts ?? 0;
  const totalOi = Math.round(oi[0]?.total_oi_usd || 0);

  const data = {
    generatedAt: new Date().toISOString(),
    totals: {
      cumVolume: Math.round(latest.cumulative_volume_usd || 0),
      cumFees: Math.round(latest.cumulative_total_fees_usd || 0),
      cumTrades: latest.cumulative_trades || 0,
      accounts: latestAccts,
      tvl: latestTvl,
      oi: totalOi,
    },
    volume,
    feesByMarket,
    liqFeesByMarket,
    fees: {
      total: Math.round(latest.cumulative_total_fees_usd || 0),
      taker: Math.round((latest.cumulative_taker_fees_usd ?? latest.cumulative_trading_fees_usd) || 0),
      maker: Math.round(latest.cumulative_maker_fees_usd || 0),
      liq: Math.round((latest.cumulative_liquidation_fees_usd || 0)),
    },
    liqTotals: {
      count: liq[0]?.alltime_liquidation_count || 0,
      volume: Math.round(liq[0]?.alltime_liquidation_volume_usd || 0),
      fees: Math.round(liq[0]?.alltime_liquidation_fees_usd || 0),
      dailyCount: liq[0]?.daily_liquidation_count || 0,
      dailyVolume: Math.round(liq[0]?.daily_liquidation_volume_usd || 0),
      dailyFees: Math.round(liq[0]?.daily_liquidation_fees_usd || 0),
    },
    tvl: tvlSeries,
    accounts: accountsSeries,
    oiByMarket: oi.map((r) => ({ symbol: sym(r.market_name), oiUsd: Math.round(r.oi_usd || 0) })).sort((a, b) => b.oiUsd - a.oiUsd),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data));
  console.log(`✅ dune.json · ${volume.length} vol days · cumVol $${(data.totals.cumVolume / 1e9).toFixed(2)}B · fees $${(data.totals.cumFees / 1e3).toFixed(0)}K · ${data.totals.accounts} accounts · TVL $${(data.totals.tvl / 1e6).toFixed(1)}M`);
}

main().catch((e) => {
  console.error("fetch-dune failed:", e);
  process.exit(1);
});
