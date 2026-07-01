import { RISEX_API } from "./constants";
import { num } from "./format";

async function api<T>(path: string, revalidate = 10): Promise<T | null> {
  try {
    const r = await fetch(`${RISEX_API}${path}`, { next: { revalidate } });
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
export async function getCandles(marketId: string | number, resolution = "60", limit = 200): Promise<Candle[]> {
  const d = await api<{ data?: RawCandle[] } | RawCandle[]>(
    `/v1/markets/id/${marketId}/trading-view-data?resolution=${resolution}`,
    30,
  );
  const arr = (Array.isArray(d) ? d : d?.data) ?? [];
  return arr
    .map((k) => ({ t: Math.floor(num(k.time) / 1_000_000), o: num(k.open), h: num(k.high), l: num(k.low), c: num(k.close), v: num(k.volume) }))
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
