// RISEx Analytics API (docs.risescan.io) — Bearer-auth analytics layer that fills
// the gaps the raw api.rise.trade leaves (aggregated volume/fees history, OI
// history, long/short skew, liquidation heatmaps, leaderboards, smart-money).
// Server-side only. Every call fails soft (null / []).

const BASE = process.env.RISESCAN_API_BASE || "https://api.risescan.io";
const KEY = process.env.RISESCAN_API_KEY || "";

async function rget<T>(path: string, revalidate = 60): Promise<T | null> {
  if (!KEY) return null;
  try {
    const r = await fetch(`${BASE}${path}`, {
      headers: { accept: "application/json", Authorization: `Bearer ${KEY}` },
      next: { revalidate },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

const nz = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const ms = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

// ── markets/summary — mark, OI, funding_1h, volume_24h, long_pct, spark_24h[] ──
export interface SummaryRow {
  marketId: string;
  market: string;
  symbol: string;
  mark: number;
  oiUsd: number;
  funding1h: number;
  volume24h: number;
  longPct: number;
  spark: number[];
}
export async function getSummary(): Promise<SummaryRow[]> {
  const j = await rget<any[]>("/api/v1/markets/summary", 30);
  if (!Array.isArray(j)) return [];
  return j.map((r) => ({
    marketId: String(r.market_id),
    market: r.market,
    symbol: String(r.market || "").replace(/\/USDC$/i, ""),
    mark: nz(r.mark_price),
    oiUsd: nz(r.open_interest),
    funding1h: nz(r.funding_1h),
    // RiseScan returns base-asset quantity here, unlike RISEx quote volume.
    volume24h: nz(r.volume_24h) * nz(r.mark_price),
    longPct: nz(r.long_pct),
    spark: Array.isArray(r.spark_24h) ? r.spark_24h.map(nz) : [],
  }));
}

// ── stats/perp-volume — exchange-wide volume/fees/fills history ──
export interface VolumePoint { t: number; volume: number; fees: number; fills: number; accounts: number }
export async function getPerpVolume(granularity: "1h" | "1d" = "1d", limit = 60): Promise<VolumePoint[]> {
  // The API exposes hourly buckets and does not accept `interval`. Fetch enough
  // pages and aggregate locally when a daily view is requested.
  const wantedHours = granularity === "1d" ? Math.max(48, limit * 24 + 24) : limit;
  const firstLimit = Math.min(1_000, wantedHours);
  const secondLimit = Math.min(1_000, Math.max(0, wantedHours - firstLimit));
  const [first, second] = await Promise.all([
    rget<any[]>(`/api/v1/stats/perp-volume?limit=${firstLimit}&offset=0`, 120),
    secondLimit > 0
      ? rget<any[]>(`/api/v1/stats/perp-volume?limit=${secondLimit}&offset=${firstLimit}`, 120)
      : Promise.resolve([]),
  ]);
  const raw = [
    ...(Array.isArray(first) ? first : []),
    ...(Array.isArray(second) ? second : []),
  ];
  const byTimestamp = new Map<number, VolumePoint>();
  for (const r of raw) {
    const t = ms(r.bucket);
    if (t > 0) byTimestamp.set(t, { t, volume: nz(r.volume), fees: nz(r.fees), fills: nz(r.fills), accounts: nz(r.unique_accounts_est) });
  }
  const hourly = [...byTimestamp.values()].sort((a, b) => a.t - b.t);
  if (granularity === "1h") return hourly.slice(-limit);

  const byDay = new Map<number, VolumePoint>();
  for (const point of hourly) {
    const d = new Date(point.t);
    const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const cur = byDay.get(t) ?? { t, volume: 0, fees: 0, fills: 0, accounts: 0 };
    cur.volume += point.volume;
    cur.fees += point.fees;
    cur.fills += point.fills;
    // Hourly unique-account estimates cannot be summed without double counting.
    cur.accounts = Math.max(cur.accounts, point.accounts);
    byDay.set(t, cur);
  }
  return [...byDay.values()].sort((a, b) => a.t - b.t).slice(-limit);
}

// ── stats/positions — current aggregate long/short OI + profit ratio + equity ──
export interface PositionsStat {
  longOiUsd: number; shortOiUsd: number; numLongs: number; numShorts: number;
  accountsInProfit: number; accountsTotal: number; totalEquity: number;
}
export async function getPositionsStat(): Promise<PositionsStat | null> {
  const r = await rget<any>("/api/v1/stats/positions", 30);
  if (!r) return null;
  return {
    longOiUsd: nz(r.long_oi_notional), shortOiUsd: nz(r.short_oi_notional),
    numLongs: nz(r.num_longs), numShorts: nz(r.num_shorts),
    accountsInProfit: nz(r.accounts_in_profit), accountsTotal: nz(r.accounts_total),
    totalEquity: nz(r.total_equity),
  };
}

// ── per-market OI history; aggregate = sum across top markets by bucket ──
export interface OiPoint { t: number; longUsd: number; shortUsd: number; totalUsd: number }
async function getMarketOiHistory(marketId: string, limit: number): Promise<OiPoint[]> {
  const j = await rget<any[]>(`/api/v1/markets/${marketId}/oi-history?limit=${Math.min(1_000, Math.max(1, limit))}`, 60);
  if (!Array.isArray(j)) return [];
  return j.map((r) => {
    const longUsd = nz(r.long_oi_notional), shortUsd = nz(r.short_oi_notional);
    return { t: ms(r.snapshot_time), longUsd, shortUsd, totalUsd: longUsd + shortUsd };
  }).filter((p) => p.t > 0);
}
// Exchange-wide OI over time. `topN = 0` includes every market with live OI;
// a positive value is reserved for deliberately scoped ranking views.
export async function getAggOiHistory(limit = 24, topN = 0): Promise<OiPoint[]> {
  const summary = await getSummary();
  if (!summary.length) return [];
  const ranked = [...summary].filter((market) => market.oiUsd > 0).sort((a, b) => b.oiUsd - a.oiUsd);
  const top = topN > 0 ? ranked.slice(0, topN) : ranked;
  if (!top.length) return [];
  // Roughly one snapshot every 1–2 minutes; 1,000 points yields about 24h.
  const series = await Promise.all(top.map((m) => getMarketOiHistory(m.marketId, 1_000)));
  const byT = new Map<number, { longUsd: number; shortUsd: number }>();
  for (const s of series) {
    const latestByHour = new Map<number, OiPoint>();
    for (const p of s) {
      const hour = Math.floor(p.t / 3_600_000) * 3_600_000;
      const prev = latestByHour.get(hour);
      if (!prev || p.t > prev.t) latestByHour.set(hour, p);
    }
    for (const [hour, p] of latestByHour) {
      const cur = byT.get(hour) ?? { longUsd: 0, shortUsd: 0 };
      cur.longUsd += p.longUsd;
      cur.shortUsd += p.shortUsd;
      byT.set(hour, cur);
    }
  }
  return [...byT.entries()]
    .map(([t, v]) => ({ t, longUsd: v.longUsd, shortUsd: v.shortUsd, totalUsd: v.longUsd + v.shortUsd }))
    .sort((a, b) => a.t - b.t)
    .slice(-limit);
}

// ── liquidation heatmap (per market) — notional binned by liq price ──
export interface LiqBin { priceLow: number; priceHigh: number; longUsd: number; shortUsd: number; count: number }
export async function getLiquidationHeatmap(marketId: string): Promise<LiqBin[]> {
  const j = await rget<any[]>(`/api/v1/markets/${marketId}/liquidation-heatmap`, 120);
  if (!Array.isArray(j)) return [];
  return j.map((r) => ({
    priceLow: nz(r.price_low), priceHigh: nz(r.price_high),
    longUsd: nz(r.long_notional), shortUsd: nz(r.short_notional), count: nz(r.position_count),
  })).filter((b) => b.priceHigh > 0);
}

// ── radar (smart money) ──
export interface RadarTrending {
  mostNetBought?: { market: string; value: number };
  mostNetSold?: { market: string; value: number };
  biggestOpen?: { market: string; value: number; account: string; leverage: number; side: number };
}
export async function getRadarTrending(): Promise<RadarTrending | null> {
  const r = await rget<any>("/api/v1/radar/trending", 30);
  if (!r) return null;
  const pick = (o: any) => (o ? { market: o.market, value: nz(o.value), account: o.account, leverage: nz(o.leverage), side: nz(o.side) } : undefined);
  return { mostNetBought: pick(r.most_net_bought), mostNetSold: pick(r.most_net_sold), biggestOpen: pick(r.biggest_open) };
}

export interface RadarEvent { t: number; action: string; market: string; side: number; leverage: number; notional: number; price: number; account: string; segment: string }
export async function getRadarActivity(limit = 12): Promise<RadarEvent[]> {
  const j = await rget<any[]>(`/api/v1/radar/activity?limit=${limit}`, 20);
  if (!Array.isArray(j)) return [];
  return j.map((r) => ({
    t: ms(r.time), action: r.action, market: String(r.market || "").replace(/\/USDC$/i, ""),
    side: nz(r.side), leverage: nz(r.leverage), notional: nz(r.notional), price: nz(r.price),
    account: r.account, segment: r.segment_label || "",
  }));
}

// ── segments (cohorts) ──
export interface Segment { id: number; slug: string; label: string; members: number }
export async function getSegments(): Promise<Segment[]> {
  const j = await rget<any[]>("/api/v1/segments", 300);
  if (!Array.isArray(j)) return [];
  return j.map((r) => ({ id: nz(r.segment_id), slug: r.slug, label: r.label, members: nz(r.member_count) }));
}

// ── leaderboards ──
export interface LeaderRow { account: string; value: number; extra?: number }
export async function getLeaderboardVolume(limit = 10): Promise<LeaderRow[]> {
  const j = await rget<any[]>(`/api/v1/leaderboards/volume?limit=${limit}`, 120);
  if (!Array.isArray(j)) return [];
  return j.map((r) => ({ account: r.address ?? r.account, value: nz(r.volume ?? r.value), extra: nz(r.trades_count ?? r.fills) }));
}
export async function getLeaderboardPnl(limit = 10): Promise<LeaderRow[]> {
  const j = await rget<any[]>(`/api/v1/leaderboards/perp-pnl?limit=${limit}`, 120);
  if (!Array.isArray(j)) return [];
  return j.map((r) => ({ account: r.address ?? r.account, value: nz(r.total_pnl ?? r.pnl ?? r.value), extra: nz(r.volume) }));
}
