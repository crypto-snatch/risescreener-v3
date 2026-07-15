import { getMarkets, symbolOf, change24hPct, type Market } from "./risex";
import { RISEX_API, EXPLORER_API, CONTRACTS } from "./constants";
import { num } from "./format";

// ── per-market enriched row (the screener's core unit) ──
export interface MarketRow {
  marketId: string;
  symbol: string;
  mark: number;
  index: number;
  last: number;
  changePct: number; // 24h
  oiTokens: number;
  oiUsd: number;
  oiLimitTokens: number;
  oiUtilPct: number; // oi / oi_limit
  volume24h: number;
  high24h: number;
  low24h: number;
  fundingCur: number; // current funding rate (fraction)
  funding8h: number; // 8h funding (fraction)
  fundingPredicted: number;
  fundingApr: number; // annualized %, from 8h
  basis: number; // mark - index
  basisPct: number; // (mark-index)/index * 100
  maxLev: number;
  maintMarginFactor: number;
  nextFundingMs: number;
}

function activeMarkets(ms: Market[]): Market[] {
  // RISEx renamed the tradable flag "available" → "active". Accept either (default
  // included) so a rename can't zero out the market count / 24h volume KPIs.
  return ms.filter((m) => (m.active ?? m.available ?? true) && !/deprecated/i.test(m.config?.name ?? ""));
}

export function enrichMarket(m: Market): MarketRow {
  const mark = num(m.mark_price) || num(m.last_price);
  const index = num(m.index_price);
  const oiTokens = num(m.open_interest);
  const oiLimitTokens = num(m.config.open_interest_limit);
  const f8 = num(m.funding_rate_8h);
  return {
    marketId: String(m.market_id),
    symbol: symbolOf(m),
    mark,
    index,
    last: num(m.last_price),
    changePct: change24hPct(m),
    oiTokens,
    oiUsd: oiTokens * mark,
    oiLimitTokens,
    oiUtilPct: oiLimitTokens > 0 ? (oiTokens / oiLimitTokens) * 100 : 0,
    volume24h: num(m.quote_volume_24h),
    high24h: num(m.high_24h),
    low24h: num(m.low_24h),
    fundingCur: num(m.current_funding_rate),
    funding8h: f8,
    fundingPredicted: num(m.predicted_funding_rate),
    fundingApr: f8 * 3 * 365 * 100, // 8h → /day (×3) → /yr (×365), as %
    basis: mark - index,
    basisPct: index > 0 ? ((mark - index) / index) * 100 : 0,
    maxLev: num(m.config.max_leverage),
    maintMarginFactor: num(m.config.maintenance_margin_factor),
    nextFundingMs: Math.floor(num(m.next_funding_time) / 1_000_000),
  };
}

export async function getMarketRows(): Promise<MarketRow[]> {
  const ms = activeMarkets(await getMarkets());
  return ms.map(enrichMarket).sort((a, b) => b.oiUsd - a.oiUsd);
}

// ── wallet composition (/v1/stats/wallets) ──
export interface WalletStats {
  total: number;
  bots: number;
  mm: number;
  real: number;
}
export async function getWalletStats(): Promise<WalletStats> {
  try {
    const r = await fetch(`${RISEX_API}/v1/stats/wallets`, { next: { revalidate: 120 } });
    const j = (await r.json()) as { data: { total_traders: string; bot_wallets: string; mm_wallets: string; real_wallets: string } };
    const d = j.data;
    return { total: num(d.total_traders), bots: num(d.bot_wallets), mm: num(d.mm_wallets), real: num(d.real_wallets) };
  } catch {
    return { total: 0, bots: 0, mm: 0, real: 0 };
  }
}

// ── TVL = CollateralManager USDC balance (Blockscout token-balances) ──
export async function getTvl(): Promise<number> {
  try {
    const r = await fetch(`${EXPLORER_API}/addresses/${CONTRACTS.CollateralManager}/token-balances`, { next: { revalidate: 120 } });
    const arr = (await r.json()) as { value: string; token: { symbol: string; decimals: string } }[];
    const usdc = arr.find((t) => /usd/i.test(t.token?.symbol ?? ""));
    if (!usdc) return 0;
    return num(usdc.value) / Math.pow(10, num(usdc.token.decimals));
  } catch {
    return 0;
  }
}

// ── protocol-level KPIs (summary screener) ──
// live on-chain but presented as upcoming (no live price feed yet)
const FORCE_UPCOMING = new Set(["ONDO", "VVV", "LIT"]);
export function isUpcoming(r: MarketRow): boolean {
  return r.mark <= 0 || FORCE_UPCOMING.has(r.symbol);
}

export interface Protocol {
  marketsCount: number;
  listedMarkets: number;
  upcomingMarkets: number;
  totalOiUsd: number;
  totalVolume24h: number;
  tvl: number;
  wallets: WalletStats;
  topByOi: MarketRow[];
  topMovers: MarketRow[]; // by |changePct|
  topFunding: MarketRow[]; // by |fundingApr|
}

export async function getProtocol(): Promise<Protocol> {
  const [rows, tvl, wallets] = await Promise.all([getMarketRows(), getTvl(), getWalletStats()]);
  const upcoming = rows.filter(isUpcoming).length;
  return {
    marketsCount: rows.length,
    listedMarkets: rows.length - upcoming,
    upcomingMarkets: upcoming,
    totalOiUsd: rows.reduce((s, r) => s + r.oiUsd, 0),
    totalVolume24h: rows.reduce((s, r) => s + r.volume24h, 0),
    tvl,
    wallets,
    topByOi: [...rows].sort((a, b) => b.oiUsd - a.oiUsd).slice(0, 5),
    topMovers: [...rows].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 5),
    topFunding: [...rows].sort((a, b) => Math.abs(b.fundingApr) - Math.abs(a.fundingApr)).slice(0, 5),
  };
}
