import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Historical RISEx data pulled from Dune (scripts/fetch-dune.mjs → data/dune.json).
// In production a cron refreshes it and the app reads it via DUNE_URL (raw URL).
export interface DuneData {
  generatedAt: string;
  totals: { cumVolume: number; cumFees: number; cumTrades: number; accounts: number; tvl: number; oi: number };
  volume: CoinDay[];
  feesByMarket: CoinDay[];
  liqFeesByMarket: CoinDay[];
  fees: { total: number; taker: number; maker: number; liq: number };
  liqTotals: { count: number; volume: number; fees: number; dailyCount: number; dailyVolume: number; dailyFees: number };
  tvl: { t: number; tvl: number; deposits: number; withdrawals: number; net: number }[];
  accounts: { t: number; newAccounts: number; activeTraders: number; cumAccounts: number }[];
  oiByMarket: { symbol: string; oiUsd: number }[];
}
export type CoinDay = { t: number; BTC: number; ETH: number; SOL: number; HYPE: number; Others: number };

let cache: { at: number; data: DuneData | null } | null = null;

// Default to the public raw URL so the deployed app reads the cron-committed
// Dune snapshot over HTTP; the bundled file is not reliably present in the
// Vercel serverless bundle. DUNE_URL overrides; local file is a last resort.
const RAW_URL = "https://raw.githubusercontent.com/crypto-snatch/risescreener-v3/main/data/dune.json";

export async function getDune(): Promise<DuneData | null> {
  if (cache && Date.now() - cache.at < 30_000) return cache.data;
  const url = process.env.DUNE_URL || RAW_URL;
  try {
    let raw: string;
    try {
      const r = await fetch(url, { next: { revalidate: 300 } });
      if (!r.ok) throw new Error(`dune ${r.status}`);
      raw = await r.text();
    } catch {
      raw = await readFile(join(process.cwd(), "data", "dune.json"), "utf8");
    }
    const data = JSON.parse(raw) as DuneData;
    // Drop the in-progress current UTC day — its daily bucket is partial (a tiny
    // bar at the chart's right edge). Charts/series should show complete days only.
    const startTodayUTC = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    const dropToday = (a?: CoinDay[]) => (a ? a.filter((x) => x.t < startTodayUTC) : a);
    if (data.volume) data.volume = dropToday(data.volume)!;
    if (data.feesByMarket) data.feesByMarket = dropToday(data.feesByMarket)!;
    if (data.liqFeesByMarket) data.liqFeesByMarket = dropToday(data.liqFeesByMarket)!;
    cache = { at: Date.now(), data };
    return data;
  } catch {
    cache = { at: Date.now(), data: null };
    return null;
  }
}
