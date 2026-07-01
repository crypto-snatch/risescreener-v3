// RiseScreener account indexer.
//
// There is no global ranking endpoint on RISEx (the public /v1/leaderboard is
// empty), and the on-chain tx.from is an operator/relayer — not the trader.
// The real trader accounts appear as indexed topics in CollateralManager's
// DepositedCollateral / WithdrawnCollateral events. So we:
//   1. enumerate EVERY account from those logs (full pagination),
//   2. query each account's positions + fills + cross-margin balance (rate-limited),
//   3. rank by OI / uPnL / volume, AND derive cohorts (by equity),
//      per-market long/short skew, and near-liquidation positions,
//   4. write a snapshot to data/leaderboard.json for the app to serve.
//
// Env: INDEX_LIMIT=N caps scored accounts (sampling for local dev).
//      ENUM_PAGES=N caps Blockscout log pages during enumeration.
// Run: node scripts/index-leaderboard.mjs   (npm run index)
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "leaderboard.json");

const API = "https://api.rise.trade";
const BS = "https://explorer.risechain.com/api/v2";
const CM = "0x2C03C7d7e2974C6599b6B108879109281ef3F818";
const DEP = "0x1a52dc5f"; // DepositedCollateral topic0 prefix
const WIT = "0xba06d99e"; // WithdrawnCollateral topic0 prefix
const EXCLUDE = new Set([
  "0xe436820ba0c69702c1d3e601d421c0ef38262739", // USDC
  "0x2c03c7d7e2974c6599b6b108879109281ef3f818", // CollateralManager
  "0xaadde0cea454f2bcb26f46ed54c5709b7bb34a7e", // Router
  "0x53f10facfc8965750494e6965f5d6da39b41d852", // PerpsManager
]);
const WAD = 1e18;
const LIMIT = Number(process.env.INDEX_LIMIT) || 0;
const ENUM_PAGES = Number(process.env.ENUM_PAGES) || 400;

// equity cohorts (by account equity = collateral + uPnL)
const TIERS = [
  { tier: "shrimp", label: "Shrimp (<$1k)", min: 0, max: 1e3 },
  { tier: "fish", label: "Fish ($1k–$10k)", min: 1e3, max: 1e4 },
  { tier: "dolphin", label: "Dolphin ($10k–$100k)", min: 1e4, max: 1e5 },
  { tier: "shark", label: "Shark ($100k–$1M)", min: 1e5, max: 1e6 },
  { tier: "whale", label: "Whale (≥$1M)", min: 1e6, max: Infinity },
];

const j = async (u, opts) => {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(u, opts);
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((res) => setTimeout(res, 300 * (i + 1)));
  }
  return null;
};

async function enumerateAccounts() {
  const accts = new Set();
  let url = `${BS}/addresses/${CM}/logs`;
  let pages = 0;
  const t0 = Date.now();
  while (url && pages < ENUM_PAGES) {
    const r = await j(url);
    if (!r || !r.items) break;
    for (const it of r.items) {
      const t0h = (it.topics?.[0] || "").slice(0, 10);
      if (t0h === DEP || t0h === WIT) {
        for (const tp of (it.topics || []).slice(1)) {
          if (tp && /^0x0{24}[0-9a-f]{40}$/i.test(tp)) {
            const a = "0x" + tp.slice(26).toLowerCase();
            if (!EXCLUDE.has(a)) accts.add(a);
          }
        }
      }
    }
    pages++;
    if (pages % 20 === 0)
      console.log(`  …enumerated ${accts.size} accounts (${pages} pages, ${((Date.now() - t0) / 1000) | 0}s)`);
    const p = r.next_page_params;
    if (!p) break;
    const qs = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    url = `${BS}/addresses/${CM}/logs?${qs}`;
  }
  return [...accts];
}

async function getMarkets() {
  const d = await j(`${API}/v1/markets`);
  return (d?.data?.markets || []).filter((m) => m.available);
}
async function getMark(id) {
  const d = await j(`${API}/v1/orderbook?market_id=${id}&limit=1`);
  const bid = Number(d?.data?.bids?.[0]?.price) || 0;
  const ask = Number(d?.data?.asks?.[0]?.price) || 0;
  return bid && ask ? (bid + ask) / 2 : bid || ask || 0;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
      if (idx % 250 === 0 && idx) console.log(`  …scored ${idx}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

const VOL_WINDOW_NS = 24 * 60 * 60 * 1e9; // 24h in nanoseconds (fill.time is ns)

// isolated-margin liquidation price approximation (cross-margin is more forgiving,
// so this is a conservative "worst-case per position" estimate for the risk view).
function liqPrice(entry, lev, mmf, isLong) {
  if (!entry || !lev) return 0;
  const m = 1 / lev - mmf; // buffer from entry to liquidation, as a fraction
  return isLong ? entry * (1 - m) : entry * (1 + m);
}

async function scoreAccount(account, marks, mmf, symbols) {
  const [pd, fd, bd] = await Promise.all([
    j(`${API}/v1/positions?account=${account}`),
    j(`${API}/v1/trade-history?account=${account}&limit=200`),
    j(`${API}/v1/account/cross-margin-balance?account=${account}`),
  ]);
  const positions = (pd?.data?.positions || []).filter((p) => Number(p.size) !== 0);
  const balance = Number(bd?.data?.balance) || 0; // collateral (human-scaled)
  let oi = 0, uPnl = 0, top = null;
  const pos = [];
  for (const p of positions) {
    const sizeTok = Math.abs(Number(p.size) / WAD);
    const entry = Number(p.avg_entry_price) / WAD;
    const lev = Number(p.leverage) / WAD;
    const mark = marks[p.market_id] || 0;
    const isLong = p.side === "BUY";
    const dir = isLong ? 1 : -1;
    const notional = sizeTok * mark;
    const pnl = (mark - entry) * sizeTok * dir;
    oi += notional;
    uPnl += pnl;
    const symbol = symbols[p.market_id] || `#${p.market_id}`;
    const lp = liqPrice(entry, lev, mmf[p.market_id] || 0, isLong);
    const distPct = mark > 0 && lp > 0 ? (Math.abs(mark - lp) / mark) * 100 : null;
    pos.push({ symbol, side: isLong ? "long" : "short", notional, lev, entry, mark, liqPrice: lp, distPct });
    if (!top || notional > top.notional) top = { symbol, side: isLong ? "long" : "short", lev, notional };
  }
  const equity = balance + uPnl;
  const fills = fd?.data?.trades || fd?.data?.fills || [];
  const cutoffNs = Date.now() * 1e6 - VOL_WINDOW_NS;
  const volume = fills
    .filter((f) => Number(f.time) >= cutoffNs)
    .reduce((s, f) => s + Number(f.price) * Number(f.size), 0);
  // 30d rollups (capped by the 200-fill window — approximate for ranking)
  const cut30 = Date.now() * 1e6 - 30 * 24 * 60 * 60 * 1e9;
  const recent30 = fills.filter((f) => Number(f.time) >= cut30);
  const vol30d = recent30.reduce((s, f) => s + Number(f.price) * Number(f.size), 0);
  const pnl30d = recent30.reduce((s, f) => s + Number(f.realized_pnl || 0), 0);
  return { account, equity, oi, uPnl, volume, vol30d, pnl30d, positionCount: positions.length, top, pos };
}

function tierOf(equity) {
  for (const t of TIERS) if (equity >= t.min && equity < t.max) return t.tier;
  return "shrimp";
}

async function main() {
  console.log(`RiseScreener indexer starting…${LIMIT ? ` (INDEX_LIMIT=${LIMIT})` : ""}`);
  let accounts = await enumerateAccounts();
  const totalAccounts = accounts.length;
  console.log(`Enumerated ${totalAccounts} unique accounts.`);
  if (LIMIT) accounts = accounts.slice(0, LIMIT);

  const markets = await getMarkets();
  const symbols = {};
  const marks = {};
  const mmf = {};
  await Promise.all(
    markets.map(async (m) => {
      symbols[m.market_id] = (m.config?.name || m.base_asset_symbol || "?").replace("/USDC", "");
      mmf[m.market_id] = Number(m.config?.maintenance_margin_factor) / WAD || 0;
      marks[m.market_id] = await getMark(m.market_id);
    }),
  );
  console.log(`Loaded ${markets.length} markets + marks.`);

  const t0 = Date.now();
  const rows = await mapLimit(accounts, 20, (a) => scoreAccount(a, marks, mmf, symbols));
  console.log(`Scored ${rows.length} accounts in ${((Date.now() - t0) / 1000) | 0}s.`);

  const withPos = rows.filter((r) => r.positionCount > 0);

  // ── cohorts by equity ──
  const cohorts = TIERS.map((t) => ({ tier: t.tier, label: t.label, min: t.min, max: t.max === Infinity ? null : t.max, count: 0, equity: 0, uPnl: 0, longUsd: 0, shortUsd: 0 }));
  const cohortByTier = Object.fromEntries(cohorts.map((c) => [c.tier, c]));
  for (const r of rows) {
    if (r.equity <= 0 && r.positionCount === 0) continue; // ignore empty/never-funded
    const c = cohortByTier[tierOf(r.equity)];
    c.count++;
    c.equity += r.equity;
    c.uPnl += r.uPnl;
    for (const p of r.pos) (p.side === "long" ? (c.longUsd += p.notional) : (c.shortUsd += p.notional));
  }

  // ── per-market long/short skew ──
  const skewMap = {};
  for (const r of withPos)
    for (const p of r.pos) {
      const s = (skewMap[p.symbol] ||= { symbol: p.symbol, longUsd: 0, shortUsd: 0 });
      p.side === "long" ? (s.longUsd += p.notional) : (s.shortUsd += p.notional);
    }
  const marketSkew = Object.values(skewMap)
    .map((s) => ({ ...s, netUsd: s.longUsd - s.shortUsd, totalUsd: s.longUsd + s.shortUsd, longPct: s.longUsd + s.shortUsd > 0 ? (s.longUsd / (s.longUsd + s.shortUsd)) * 100 : 50 }))
    .sort((a, b) => b.totalUsd - a.totalUsd);

  // ── near-liquidation positions (at-risk) ──
  const atRisk = withPos
    .flatMap((r) => r.pos.filter((p) => p.distPct != null && p.notional > 0).map((p) => ({ account: r.account, ...p })))
    .sort((a, b) => a.distPct - b.distPct)
    .slice(0, 40);

  // ── liquidation map: per-market notional clustered by liquidation price ──
  // Longs liquidate below mark, shorts above. Bin liqPrice → long/short notional.
  const posBySym = {};
  for (const r of withPos)
    for (const p of r.pos)
      if (p.liqPrice > 0 && p.notional > 0) (posBySym[p.symbol] ||= []).push(p);
  const NBINS = 26;
  const liqMap = Object.entries(posBySym)
    .map(([symbol, ps]) => {
      const mark = ps[0].mark;
      const prices = ps.map((p) => p.liqPrice);
      let lo = Math.min(mark, ...prices);
      let hi = Math.max(mark, ...prices);
      if (hi <= lo) hi = lo * 1.01 + 1;
      const w = (hi - lo) / NBINS;
      const bins = Array.from({ length: NBINS }, (_, i) => ({ price: lo + (i + 0.5) * w, longUsd: 0, shortUsd: 0 }));
      for (const p of ps) {
        let idx = Math.floor((p.liqPrice - lo) / w);
        idx = Math.max(0, Math.min(NBINS - 1, idx));
        if (p.side === "long") bins[idx].longUsd += p.notional;
        else bins[idx].shortUsd += p.notional;
      }
      const total = ps.reduce((s, p) => s + p.notional, 0);
      return { symbol, mark, count: ps.length, total, bins };
    })
    .filter((m) => m.count >= 2)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // ── leaderboard trend charts: top-10 wallets' 30d daily series ──
  const DAY = 86400000;
  const START = Date.now() - 30 * DAY;
  const groups = {
    volume: [...rows].filter((r) => r.vol30d > 0).sort((a, b) => b.vol30d - a.vol30d).slice(0, 10),
    pnl: [...rows].filter((r) => Math.abs(r.pnl30d) > 0).sort((a, b) => b.pnl30d - a.pnl30d).slice(0, 10),
    oi: [...rows].filter((r) => r.oi > 0).sort((a, b) => b.oi - a.oi).slice(0, 10),
  };
  const unionAccts = [...new Set([...groups.volume, ...groups.pnl, ...groups.oi].map((r) => r.account))];

  async function walletSeries(account) {
    const fd = await j(`${API}/v1/trade-history?account=${account}&limit=1000`);
    const arr = (fd?.data?.trades || fd?.data?.fills || []).slice().sort((a, b) => Number(a.time) - Number(b.time));
    const vol = {}, pnl = {}, net = {};
    let cum = 0, netTok = 0;
    for (const f of arr) {
      const ms = Number(f.time) / 1e6;
      const priceN = Number(f.price), sizeN = Number(f.size);
      cum += Number(f.realized_pnl || 0);
      netTok += (f.side === "BUY" ? 1 : -1) * sizeN;
      if (ms < START) continue; // pre-window fills only advance anchors
      const day = Math.floor(ms / DAY) * DAY;
      vol[day] = (vol[day] || 0) + priceN * sizeN;
      pnl[day] = cum;
      net[day] = Math.abs(netTok) * priceN;
    }
    return { vol, pnl, net };
  }
  const seriesByAcct = {};
  {
    const built = await mapLimit(unionAccts, 12, (a) => walletSeries(a));
    unionAccts.forEach((a, i) => (seriesByAcct[a] = built[i] || { vol: {}, pnl: {}, net: {} }));
  }
  function buildTrend(groupRows, metric, totalKey, carry) {
    const accts = groupRows.map((r) => r.account);
    const daySet = new Set();
    for (const a of accts) for (const d of Object.keys(seriesByAcct[a]?.[metric] || {})) daySet.add(Number(d));
    const days = [...daySet].sort((x, y) => x - y);
    const last = {};
    const data = days.map((t) => {
      const row = { t };
      accts.forEach((a, i) => {
        const v = seriesByAcct[a]?.[metric]?.[t];
        if (v != null) { row["w" + i] = v; last[i] = v; }
        else row["w" + i] = carry ? (last[i] ?? 0) : 0;
      });
      return row;
    });
    return { accounts: groupRows.map((r, i) => ({ key: "w" + i, account: r.account, total: r[totalKey] })), data };
  }
  const leaderTrends = {
    volume: buildTrend(groups.volume, "vol", "vol30d", false),
    pnl: buildTrend(groups.pnl, "pnl", "pnl30d", true),
    oi: buildTrend(groups.oi, "net", "oi", true),
  };

  const top = (key, n = 20) => [...rows].sort((a, b) => b[key] - a[key]).slice(0, n).map(strip);
  const strip = ({ pos, ...rest }) => rest; // drop per-position array from leaderboard rows

  const snapshot = {
    generatedAt: new Date().toISOString(),
    totalAccounts,
    scoredAccounts: rows.length,
    sampled: LIMIT > 0,
    accountsWithPositions: withPos.length,
    byOI: top("oi"),
    byUpnl: [...withPos].sort((a, b) => b.uPnl - a.uPnl).slice(0, 20).map(strip),
    byVolume: top("volume"),
    byEquity: [...rows].sort((a, b) => b.equity - a.equity).slice(0, 20).map(strip),
    cohorts,
    marketSkew,
    atRisk,
    liqMap,
    leaderTrends,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(snapshot, null, 2));
  console.log(`\n✅ Wrote ${OUT}`);
  console.log(`   totalAccounts=${totalAccounts} scored=${rows.length} withPositions=${withPos.length}`);
  console.log(`   cohorts: ${cohorts.map((c) => `${c.tier}=${c.count}`).join(" ")}`);
  console.log(`   markets with skew: ${marketSkew.length}, at-risk positions: ${atRisk.length}, liqMap markets: ${liqMap.length}`);
  console.log(`   top equity: ${snapshot.byEquity[0]?.account} ($${(snapshot.byEquity[0]?.equity || 0).toFixed(0)})`);
}

main().catch((e) => {
  console.error("indexer failed:", e);
  process.exit(1);
});
