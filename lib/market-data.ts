import { RISEX_API } from "./constants";
import { num } from "./format";

async function api<T>(path: string, revalidate = 10): Promise<T | null> {
  try {
    const r = await fetch(`${RISEX_API}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { data: T };
    return j.data;
  } catch {
    return null;
  }
}

// ── OHLCV candles ──
export interface Candle {
  t: number; // ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "1d" | "1w";

const INTERVAL_NS: Record<CandleInterval, bigint> = {
  "1m": 60_000_000_000n,
  "5m": 300_000_000_000n,
  "15m": 900_000_000_000n,
  "1h": 3_600_000_000_000n,
  "1d": 86_400_000_000_000n,
  "1w": 604_800_000_000_000n,
};

/**
 * RISEx expects interval/from/to as nanoseconds. Supplying the retired
 * `resolution` parameter silently falls back to the most recent 1-hour window,
 * so always send an explicit bounded range here.
 */
export async function getCandles(
  marketId: string | number,
  interval: CandleInterval = "5m",
  limit = 288,
): Promise<Candle[]> {
  const step = INTERVAL_NS[interval];
  const to = BigInt(Date.now()) * 1_000_000n;
  // Ask for two extra bars to absorb a partial leading/trailing bucket.
  const from = to - step * BigInt(Math.max(2, limit + 2));
  const d = await api<{ data?: RawCandle[] } | RawCandle[]>(
    `/v1/markets/id/${marketId}/trading-view-data?interval=${step.toString()}&from=${from.toString()}&to=${to.toString()}`,
    15,
  );
  const arr = (Array.isArray(d) ? d : d?.data) ?? [];
  const byTime = new Map<number, Candle>();
  for (const k of arr) {
    const candle = {
      t: Math.floor(num(k.time) / 1_000_000),
      o: num(k.open),
      h: num(k.high),
      l: num(k.low),
      c: num(k.close),
      v: num(k.volume),
    };
    if (candle.t > 0 && candle.c > 0) byTime.set(candle.t, candle);
  }
  return [...byTime.values()]
    .sort((a, b) => a.t - b.t)
    .slice(-limit);
}
interface RawCandle {
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

// ── funding rate history ──
export interface FundingPoint {
  t: number; // ms (end_time)
  rate: number; // fraction
  accumulated: number;
  index: number;
}
export async function getFundingHistory(marketId: string | number, limit = 100): Promise<FundingPoint[]> {
  const d = await api<{ records: RawFunding[] }>(`/v1/markets/id/${marketId}/funding-rate-history?limit=${limit}`, 30);
  const recs = d?.records ?? [];
  return recs
    .map((r) => ({ t: Math.floor(num(r.end_time) / 1_000_000), rate: num(r.funding_rate), accumulated: num(r.accumulated_funding), index: num(r.index_price) }))
    .reverse();
}
interface RawFunding {
  funding_rate: string;
  accumulated_funding: string;
  index_price: string;
  start_time: string;
  end_time: string;
}

// ── orderbook depth ──
export interface Depth {
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
}
export async function getDepth(marketId: string | number, limit = 25): Promise<Depth> {
  const d = await api<{ bids: { price: string; quantity: string }[]; asks: { price: string; quantity: string }[] }>(
    `/v1/orderbook?market_id=${marketId}&limit=${limit}`,
    5,
  );
  return {
    bids: (d?.bids ?? []).map((b) => ({ price: num(b.price), size: num(b.quantity) })),
    asks: (d?.asks ?? []).map((a) => ({ price: num(a.price), size: num(a.quantity) })),
  };
}
