// Broad crypto-market context from free, keyless public APIs. Every fetch is
// server-side, revalidated, and fails soft (returns null / [] on error) so the
// page never breaks when a provider rate-limits us.

const CG = "https://api.coingecko.com/api/v3";
const LLAMA = "https://api.llama.fi";
const FNG = "https://api.alternative.me/fng/";

async function jget<T>(url: string, revalidate = 300): Promise<T | null> {
  try {
    const r = await fetch(url, {
      next: { revalidate },
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// ── Global crypto stats (CoinGecko /global) ──
export interface GlobalStats {
  totalMcap: number;
  totalVol: number;
  btcDom: number;
  ethDom: number;
  mcapChange24h: number;
  activeCoins: number;
  markets: number;
}

export async function getGlobalStats(): Promise<GlobalStats | null> {
  const j = await jget<{ data: any }>(`${CG}/global`);
  const d = j?.data;
  if (!d) return null;
  return {
    totalMcap: d.total_market_cap?.usd ?? 0,
    totalVol: d.total_volume?.usd ?? 0,
    btcDom: d.market_cap_percentage?.btc ?? 0,
    ethDom: d.market_cap_percentage?.eth ?? 0,
    mcapChange24h: d.market_cap_change_percentage_24h_usd ?? 0,
    activeCoins: d.active_cryptocurrencies ?? 0,
    markets: d.markets ?? 0,
  };
}

// ── Fear & Greed index (alternative.me) ──
export interface FearGreed {
  value: number;
  label: string;
}

export async function getFearGreed(): Promise<FearGreed | null> {
  const j = await jget<{ data: { value: string; value_classification: string }[] }>(`${FNG}?limit=1`, 1800);
  const d = j?.data?.[0];
  if (!d) return null;
  return { value: Number(d.value), label: d.value_classification };
}

// ── Trending & top coins (CoinGecko) ──
export interface Coin {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  price?: number;
  change24h: number;
  image?: string;
}

export async function getTrending(): Promise<Coin[]> {
  const j = await jget<{ coins: { item: any }[] }>(`${CG}/search/trending`, 900);
  if (!j?.coins) return [];
  return j.coins.slice(0, 7).map(({ item }) => ({
    id: item.id,
    symbol: (item.symbol || "").toUpperCase(),
    name: item.name,
    rank: item.market_cap_rank ?? 0,
    price: item.data?.price,
    change24h: item.data?.price_change_percentage_24h?.usd ?? 0,
    image: item.thumb,
  }));
}

export async function getTopCoins(): Promise<Coin[]> {
  const j = await jget<any[]>(
    `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h`,
    300,
  );
  if (!Array.isArray(j)) return [];
  return j.map((c) => ({
    id: c.id,
    symbol: (c.symbol || "").toUpperCase(),
    name: c.name,
    rank: c.market_cap_rank ?? 0,
    price: c.current_price,
    change24h: c.price_change_percentage_24h ?? 0,
    image: c.image,
  }));
}

// ── Chain TVL leaderboard (DefiLlama) — RISE highlighted when present ──
export interface ChainTvl {
  name: string;
  tvl: number;
  isRise: boolean;
  rank?: number; // global rank, only set for a pinned out-of-top-N row (e.g. RISE)
}

export async function getChainTvls(): Promise<{ chains: ChainTvl[]; totalDefiTvl: number; riseRank: number | null }> {
  const j = await jget<{ name: string; tvl: number }[]>(`${LLAMA}/v2/chains`, 900);
  if (!Array.isArray(j)) return { chains: [], totalDefiTvl: 0, riseRank: null };
  const totalDefiTvl = j.reduce((s, c) => s + (c.tvl || 0), 0);
  const isRiseName = (n: string) => /^rise( chain)?$/i.test(n.trim());
  const ranked = j.filter((c) => (c.tvl || 0) > 0).sort((a, b) => b.tvl - a.tvl);
  const TOP = 12;
  const chains: ChainTvl[] = ranked.slice(0, TOP).map((c) => ({ name: c.name, tvl: c.tvl, isRise: isRiseName(c.name) }));
  // Always surface RISE: if it exists but sits below the top slice, pin it with its true rank.
  const riseIdx = ranked.findIndex((c) => isRiseName(c.name));
  const riseRank = riseIdx >= 0 ? riseIdx + 1 : null;
  if (riseIdx >= TOP) {
    const r = ranked[riseIdx];
    chains.push({ name: r.name, tvl: r.tvl, isRise: true, rank: riseIdx + 1 });
  }
  return { chains, totalDefiTvl, riseRank };
}

// ── Historical context panels ──
export interface HistoryPoint {
  t: number;
  value: number;
}

export async function getCoinPriceHistory(id: string, days = 30): Promise<HistoryPoint[]> {
  const safeId = encodeURIComponent(id);
  const safeDays = Math.max(1, Math.min(365, Math.round(days)));
  const j = await jget<{ prices?: [number, number][] }>(
    `${CG}/coins/${safeId}/market_chart?vs_currency=usd&days=${safeDays}&interval=daily`,
    900,
  );
  if (!Array.isArray(j?.prices)) return [];
  return j.prices
    .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(([t, value]) => ({ t, value }));
}

export async function getHistoricalChainTvl(chain = "Rise"): Promise<HistoryPoint[]> {
  const j = await jget<{ date?: number; tvl?: number }[]>(
    `${LLAMA}/v2/historicalChainTvl/${encodeURIComponent(chain)}`,
    1800,
  );
  if (!Array.isArray(j)) return [];
  return j
    .filter((point) => Number.isFinite(point.date) && Number.isFinite(point.tvl))
    .map((point) => ({ t: Number(point.date) * 1000, value: Number(point.tvl) }))
    .slice(-120);
}
