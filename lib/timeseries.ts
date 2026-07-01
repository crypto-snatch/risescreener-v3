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

export async function getTimeseries(): Promise<TsPoint[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.data;
  const url = process.env.TIMESERIES_URL;
  try {
    let raw: string;
    if (url) {
      const r = await fetch(url, { next: { revalidate: 120 } });
      raw = await r.text();
    } else {
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
