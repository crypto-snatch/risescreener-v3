import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Historical protocol metrics, accumulated by scripts/snapshot-timeseries.mjs
// (run on a cron). RISEx's API only exposes current + 24h, so trend charts are
// built from our own periodic snapshots — sparse at first, denser over time.
export interface CoinBreak {
  BTC: number;
  ETH: number;
  SOL: number;
  HYPE: number;
  Others: number;
}
export interface TsPoint {
  t: number; // ms
  vol: CoinBreak; // per-coin 24h volume at snapshot time
  oi: CoinBreak; // per-coin open interest ($)
  tvl: number;
  traders: number;
  realTraders: number;
}

let cache: { at: number; data: TsPoint[] } | null = null;

// Default to the public raw URL so the deployed app reads the cron-committed
// history over HTTP; the bundled file is not reliably present in the Vercel
// serverless bundle. TIMESERIES_URL overrides; local file is a last resort.
const RAW_URL = "https://raw.githubusercontent.com/crypto-snatch/risescreener-v3/main/data/timeseries.json";

export async function getTimeseries(): Promise<TsPoint[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.data;
  const url = process.env.TIMESERIES_URL || RAW_URL;
  try {
    let raw: string;
    try {
      const r = await fetch(url, { next: { revalidate: 120 } });
      if (!r.ok) throw new Error(`timeseries ${r.status}`);
      raw = await r.text();
    } catch {
      raw = await readFile(join(process.cwd(), "data", "timeseries.json"), "utf8");
    }
    const data = JSON.parse(raw) as TsPoint[];
    cache = { at: Date.now(), data: Array.isArray(data) ? data : [] };
    return cache.data;
  } catch {
    cache = { at: Date.now(), data: [] };
    return [];
  }
}
