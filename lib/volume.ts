import type { CoinDay, DuneData } from "./dune";
import type { TsPoint } from "./timeseries";
import { CMD_SYMBOLS, STOCK_SYMBOLS } from "./sectors";

// Rebuilds the daily-volume days Dune fails to deliver, from our own snapshots.
//
// Dune's RISE ingestion stalls for days at a time (it did from 2026-08-03): the
// queries keep executing, they just return zero volume for the newest days. The
// Cum Vol chart then flatlines and its cumulative line stops climbing, while the
// exchange trades ~$110M a day.
//
// scripts/snapshot-timeseries.mjs records RISEx's rolling 24h volume every
// 30 min, and a snapshot taken just after 00:00 UTC covers almost exactly the
// UTC day that just ended. Against Dune's healthy days (2026-07-27 … 08-02) the
// two agree within 1%, which is what makes publishing the reconstruction
// defensible. Days rebuilt this way are flagged `est` and the chart labels them.
//
// This runs at read time rather than in the cron so that a stall heals on the
// next page render, and so an estimate never gets frozen into committed data.

const DAY = 86_400_000;
const GROUPS = ["BTC", "ETH", "SOL", "HYPE"];
// Snapshots further than this from midnight no longer describe the day well.
const MAX_OFFSET = 3 * 3_600_000;
// Dune buckets below this share of the snapshot are partial writes, not quiet
// days — 2026-08-03 landed at 54% while the exchange traded normally.
const PARTIAL = 0.7;
// What the app counts as a day's volume: the per-market and class fields are
// breakdowns of RWA, so they must not be added on top.
const TOTAL_KEYS = ["BTC", "ETH", "SOL", "HYPE", "RWA", "Others"] as const;

export const dayTotal = (d?: CoinDay): number =>
  d ? TOTAL_KEYS.reduce((s, k) => s + (Number(d[k]) || 0), 0) : 0;

// CoinDay's per-market fields are a fixed set; indexing it by a symbol string
// needs this widening.
type MutableDay = CoinDay & Record<string, number | boolean | undefined>;

const blank = (t: number): MutableDay => ({
  t, est: true, BTC: 0, ETH: 0, SOL: 0, HYPE: 0,
  ...Object.fromEntries([...CMD_SYMBOLS, ...STOCK_SYMBOLS].map((s) => [s, 0])),
  Commodities: 0, Stocks: 0, RWA: 0, Others: 0,
});

// Per-market snapshot → a day shaped exactly like Dune's, class bands included.
function fromMarkets(t: number, by: Record<string, number>): CoinDay {
  const d = blank(t);
  for (const [s, raw] of Object.entries(by)) {
    const v = Math.round(raw || 0);
    if (CMD_SYMBOLS.includes(s)) { d[s] = (Number(d[s]) || 0) + v; d.Commodities! += v; d.RWA! += v; }
    else if (STOCK_SYMBOLS.includes(s)) { d[s] = (Number(d[s]) || 0) + v; d.Stocks! += v; d.RWA! += v; }
    else if (GROUPS.includes(s)) d[s] = (Number(d[s]) || 0) + v;
    else d.Others += v;
  }
  return d;
}

// Older snapshots kept only the grouped totals, so everything outside the big
// four lands in Others: the day total is right, the RWA split is unrecoverable.
function fromGroups(t: number, vol: TsPoint["vol"]): CoinDay {
  const d = blank(t);
  for (const [k, v] of Object.entries(vol)) {
    const g = GROUPS.includes(k) ? k : "Others";
    d[g] = (Number(d[g]) || 0) + Math.round(v || 0);
  }
  return d;
}

export interface PatchedVolume {
  volume: CoinDay[];
  cumVolume: number;
  estDays: number;
}

export function patchVolume(dune: DuneData | null, ts: TsPoint[]): PatchedVolume {
  const volume = dune?.volume ?? [];
  const cumVolume = dune?.totals.cumVolume ?? 0;
  if (!volume.length || !ts.length) return { volume, cumVolume, estDays: 0 };

  // Best snapshot for the day starting at t: the one closest to when that day
  // ended, so its trailing 24h window ≈ the day itself.
  const nearest = (t: number, needMarkets: boolean) => {
    const target = t + DAY;
    let best: TsPoint | null = null;
    for (const p of ts) {
      if (needMarkets && !p.volBy) continue;
      const off = Math.abs(p.t - target);
      if (off <= MAX_OFFSET && (!best || off < Math.abs(best.t - target))) best = p;
    }
    return best;
  };
  const estimate = (t: number): CoinDay | null => {
    const withMarkets = nearest(t, true);
    if (withMarkets?.volBy) return fromMarkets(t, withMarkets.volBy);
    const p = nearest(t, false);
    return p?.vol ? fromGroups(t, p.vol) : null;
  };

  const now = new Date();
  const startToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const byDay = new Map(volume.map((d) => [d.t, d]));
  let added = 0;
  let estDays = 0;
  for (let t = volume[0].t; t < startToday; t += DAY) {
    const have = byDay.get(t);
    const reported = dayTotal(have); // already inside dune's cumVolume
    const est = estimate(t);
    if (!est || dayTotal(est) <= 0) continue;
    if (reported >= dayTotal(est) * PARTIAL) continue; // Dune covered this day
    byDay.set(t, est);
    added += dayTotal(est) - reported;
    estDays++;
  }
  if (!estDays) return { volume, cumVolume, estDays: 0 };

  return {
    volume: [...byDay.values()].sort((a, b) => a.t - b.t),
    cumVolume: Math.round(cumVolume + added),
    estDays,
  };
}
