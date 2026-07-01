import { RISEX_API } from "./constants";
import { fromWad, num } from "./format";

// ── low-level fetch ───────────────────────────────────────────
async function api<T>(path: string, revalidate = 5): Promise<T> {
  const res = await fetch(`${RISEX_API}${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`RISEx ${path} -> ${res.status}`);
  const json = (await res.json()) as { data: T };
  return json.data;
}

// ── markets (cached) ──────────────────────────────────────────
export interface MarketCfg {
  name: string;
  max_leverage: string;
  open_interest_limit: string;
  step_price: string;
  maintenance_margin_factor: string;
}
export interface Market {
  market_id: string;
  config: MarketCfg;
  available: boolean;
  base_asset_symbol: string;
  display_name?: string;
  mark_price?: string;
  last_price?: string;
  index_price?: string;
  change_24h?: string; // absolute 24h price change
  high_24h?: string;
  low_24h?: string;
  quote_volume_24h?: string;
  open_interest?: string;
  current_funding_rate?: string;
  funding_rate_8h?: string;
  predicted_funding_rate?: string;
  next_funding_time?: string;
}

// 24h percent change from the absolute change + last price
export function change24hPct(m: Market): number {
  const last = num(m.last_price);
  const chg = num(m.change_24h);
  const open = last - chg;
  return open !== 0 ? (chg / open) * 100 : 0;
}

let _markets: { at: number; data: Market[] } | null = null;
export async function getMarkets(): Promise<Market[]> {
  if (_markets && Date.now() - _markets.at < 60_000) return _markets.data;
  const data = await api<{ markets: Market[] }>("/v1/markets", 60);
  _markets = { at: Date.now(), data: data.markets };
  return data.markets;
}

export async function getMarketMap(): Promise<Map<string, Market>> {
  const ms = await getMarkets();
  return new Map(ms.map((m) => [String(m.market_id), m]));
}

export function symbolOf(m?: Market): string {
  if (!m) return "?";
  return (m.config?.name || m.base_asset_symbol || "?").replace("/USDC", "");
}

// ── mark price via orderbook mid ──────────────────────────────
export async function getMark(marketId: string | number): Promise<number> {
  try {
    const ob = await api<{
      bids: { price: string }[];
      asks: { price: string }[];
    }>(`/v1/orderbook?market_id=${marketId}&limit=1`, 3);
    const bid = num(ob.bids?.[0]?.price);
    const ask = num(ob.asks?.[0]?.price);
    if (bid && ask) return (bid + ask) / 2;
    return bid || ask || 0;
  } catch {
    return 0;
  }
}

// ── account: positions ────────────────────────────────────────
export interface RawPosition {
  account: string;
  market_id: string;
  size: string; // 1e18 tokens
  quote_amount: string; // 1e18, signed
  side: "BUY" | "SELL";
  leverage: string; // 1e18
  avg_entry_price: string; // 1e18
  unsettled_funding: string; // 1e18
  isolated_usdc_balance: string;
  margin_mode: number;
}

export interface Position {
  account: string;
  marketId: string;
  symbol: string;
  side: "long" | "short";
  size: number; // tokens
  entry: number;
  mark: number;
  leverage: number;
  notional: number;
  margin: number;
  uPnl: number;
  uPnlPct: number;
  funding: number;
  liqApprox: number | null;
}

export async function getPositions(account: string): Promise<RawPosition[]> {
  const d = await api<{ positions: RawPosition[] }>(
    `/v1/positions?account=${account}`,
    4,
  );
  return d.positions ?? [];
}

export function enrichPosition(
  p: RawPosition,
  symbol: string,
  mark: number,
  mmf: number,
): Position {
  const sizeTok = Math.abs(fromWad(p.size));
  const entry = fromWad(p.avg_entry_price);
  const lev = fromWad(p.leverage);
  const side = p.side === "BUY" ? "long" : "short";
  const dir = side === "long" ? 1 : -1;
  const notional = sizeTok * mark;
  const margin = lev > 0 ? (sizeTok * entry) / lev : 0;
  const uPnl = (mark - entry) * sizeTok * dir;
  const uPnlPct = margin > 0 ? (uPnl / margin) * 100 : 0;
  // crude liquidation estimate: entry adjusted by (1/lev - mmf) in the adverse direction
  const mmFrac = mmf / 100; // maintenance_margin_factor is a percent-like figure
  const liqMove = entry * (1 / lev - mmFrac);
  const liqApprox = lev > 0 ? entry - dir * liqMove : null;
  return {
    account: p.account,
    marketId: p.market_id,
    symbol,
    side,
    size: sizeTok,
    entry,
    mark,
    leverage: lev,
    notional,
    margin,
    uPnl,
    uPnlPct,
    funding: fromWad(p.unsettled_funding),
    liqApprox: liqApprox && liqApprox > 0 ? liqApprox : null,
  };
}

// ── account: trade history (fills) ────────────────────────────
export interface RawFill {
  id: string;
  market_id: string;
  side: "BUY" | "SELL";
  price: string;
  size: string;
  fee: string;
  liquidity_indicator: "MAKER" | "TAKER";
  time: string; // ns
  is_liquidation: boolean;
  realized_pnl: string;
  leverage: string;
  blockchain_data: { block_number: string; tx_hash: string; log_index: string };
}

export async function getFills(account: string, limit = 50): Promise<RawFill[]> {
  const d = await api<{ trades?: RawFill[]; fills?: RawFill[] }>(
    `/v1/trade-history?account=${account}&limit=${limit}`,
    4,
  );
  return d.trades ?? d.fills ?? [];
}

// global (anonymous) trades for a market — home feed
export interface RawMarketTrade {
  id: string;
  maker_side: "BUY" | "SELL";
  price: string;
  size: string;
  time: string;
  block_number: string;
}
export async function getMarketTrades(
  marketId: string | number,
  limit = 30,
): Promise<RawMarketTrade[]> {
  const d = await api<{ trades: RawMarketTrade[] }>(
    `/v1/markets/id/${marketId}/trade-history?limit=${limit}`,
    3,
  );
  return d.trades ?? [];
}

// global feed across all active markets — for the home "rain" of trades
export interface FeedTrade {
  id: string;
  marketId: string;
  symbol: string;
  side: "BUY" | "SELL"; // taker side
  price: number;
  size: number;
  notional: number;
  time: number; // ms
}

export async function getGlobalFeed(perMarket = 12): Promise<FeedTrade[]> {
  const markets = (await getMarkets()).filter(
    (m) => m.available && !/deprecated/i.test(m.config?.name ?? ""),
  );
  const chunks = await Promise.all(
    markets.map(async (m) => {
      const trades = await getMarketTrades(m.market_id, perMarket).catch(
        () => [] as RawMarketTrade[],
      );
      const sym = symbolOf(m);
      return trades.map((t): FeedTrade => {
        const price = num(t.price);
        const size = num(t.size);
        return {
          id: t.id,
          marketId: String(m.market_id),
          symbol: sym,
          // taker side is opposite of the resting maker side
          side: t.maker_side === "SELL" ? "BUY" : "SELL",
          price,
          size,
          notional: price * size,
          time: Math.floor(Number(t.time) / 1_000_000),
        };
      });
    }),
  );
  return chunks
    .flat()
    .sort((a, b) => b.time - a.time)
    .slice(0, 80);
}

// ── account: balance & open orders ────────────────────────────
export async function getBalance(account: string): Promise<number> {
  try {
    const d = await api<{ balance: string }>(
      `/v1/account/cross-margin-balance?account=${account}`,
      5,
    );
    return num(d.balance);
  } catch {
    return 0;
  }
}

export interface RawOpenOrder {
  order_id: string;
  market_id: string;
  side: "BUY" | "SELL";
  price: string;
  size: string;
  remaining_size?: string;
}
export async function getOpenOrders(account: string): Promise<RawOpenOrder[]> {
  try {
    const d = await api<{ orders: RawOpenOrder[] }>(
      `/v1/orders/open?account=${account}`,
      5,
    );
    return d.orders ?? [];
  } catch {
    return [];
  }
}
