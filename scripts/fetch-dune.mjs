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

const startTodayUTC = () => {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
};

async function api(path, opts = {}) {
  const r = await fetch(`https://api.dune.com/api/v1${path}`, {
    ...opts,
    headers: { "X-Dune-Api-Key": KEY, ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`dune ${path} -> ${r.status}`);
  return r.json();
}

// Paginated results fetch — per-market-per-day queries outgrow a single page.
// Also returns execution_ended_at: results come from whatever execution Dune has
// cached, which may have run mid-day, so trailing day buckets can be partial.
async function resultsPages(base, pageSize = 1000) {
  const all = [];
  let offset = 0;
  let execEndedAt = null;
  for (;;) {
    const j = await api(`${base}?limit=${pageSize}&offset=${offset}`);
    execEndedAt ??= j.execution_ended_at ?? null;
    const page = j.result?.rows ?? [];
    all.push(...page);
    const total = j.result?.metadata?.total_row_count;
    offset += page.length;
    if (page.length < pageSize || (total != null && offset >= total)) break;
  }
  return { rows: all, execEndedAt };
}

// fresh: if the cached execution predates today 00:00 UTC (so it can't cover all
// of yesterday), trigger a new execution and wait for it — otherwise the chart's
// last day gets dropped as partial and the series lags an extra day. Costs Dune
// credits, so only the queries that feed the volume chart ask for it; any
// failure (credits exhausted, timeout) falls back to the cached results.
async function query(id, { fresh = false } = {}) {
  const cached = await resultsPages(`/query/${id}/results`);
  const stale = !cached.execEndedAt || new Date(cached.execEndedAt).getTime() < startTodayUTC();
  if (!fresh || !stale) return cached;
  try {
    const { execution_id } = await api(`/query/${id}/execute`, { method: "POST" });
    const t0 = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, 5000));
      const s = await api(`/execution/${execution_id}/status`);
      if (s.state === "QUERY_STATE_COMPLETED") break;
      if (["QUERY_STATE_FAILED", "QUERY_STATE_CANCELLED", "QUERY_STATE_EXPIRED"].includes(s.state)) throw new Error(s.state);
      if (Date.now() - t0 > 240_000) throw new Error("execution timeout");
    }
    console.log(`q${id}: ran fresh execution (cached was ${cached.execEndedAt})`);
    return await resultsPages(`/execution/${execution_id}/results`);
  } catch (e) {
    console.warn(`q${id}: fresh execution failed (${e.message}) — using cached results`);
    return cached;
  }
}
const rows = async (id, opts) => (await query(id, opts)).rows;
const dayMs = (s) => new Date(String(s).replace(" ", "T") + "Z").getTime();

async function main() {
  const [vbmQ, tvl, proto, accts, oi, liq] = await Promise.all([
    query(Q.volumeByMarket, { fresh: true }),
    rows(Q.tvlDaily),
    rows(Q.protocolDaily, { fresh: true }), // keeps the Cumulative-volume card in step with the chart
    rows(Q.accountsDaily),
    rows(Q.oiNow),
    rows(Q.liqTotals),
  ]);
  const vbm = vbmQ.rows;

  // Day buckets on/after the query's execution day are partial (the cached run
  // happened mid-day) — keep complete days only.
  const execMs = vbmQ.execEndedAt ? new Date(vbmQ.execEndedAt).getTime() : Date.now();
  const d = new Date(execMs);
  const cutoff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

  // volume / fees / liq-fees by market → per-day { BTC, ETH, SOL, HYPE, Others }
  const blank = (t) => ({ t, BTC: 0, ETH: 0, SOL: 0, HYPE: 0, Others: 0 });
  const byDay = new Map();
  const feeDay = new Map();
  const liqFeeDay = new Map();
  for (const r of vbm) {
    const t = dayMs(r.period);
    if (t >= cutoff) continue;
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
