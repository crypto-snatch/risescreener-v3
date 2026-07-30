// Builds data/summary.json — a once-a-day (UTC 00:00) frozen "Daily Recap" used
// by the Summary page. 24H Volume / Fees use Dune's last COMPLETE UTC day with a
// day-over-day delta; TVL uses the day-over-day change of the TVL series; OI uses
// the change vs the previous snapshot. Run on a cron after the 00:00 refreshers.
//   node scripts/snapshot-summary.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");
const OUT = join(DATA, "summary.json");

// mirror lib/format.ts
const usd = (n, opts = {}) => {
  if (n == null || !isFinite(n)) return "—";
  const sign = opts.sign && n > 0 ? "+" : n < 0 ? "−" : "";
  const a = Math.abs(n);
  let b;
  if (a >= 1e9) b = (a / 1e9).toFixed(2) + "B";
  else if (a >= 1e6) b = (a / 1e6).toFixed(2) + "M";
  else if (a >= 1e3) b = (a / 1e3).toFixed(1) + "K";
  else b = a.toFixed(2);
  return `${sign}$${b}`;
};
const shortAddr = (a) => (!a || a.length < 12 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`);
// RWA classes — Commodities (metals + oil) and Stocks. Mirrors lib/sectors.ts.
const CMD_SYMBOLS = ["XAU", "XAG", "CL", "BZ"];
const STK_SYMBOLS = ["SNDK", "SPCX"];
// "RWA" is the per-day aggregate band Dune volume writes (see fetch-dune.mjs); it
// is NOT folded into "Others", so include it here to keep the volume total whole.
// Fee CoinDays never set RWA (their RWA slice stays 0), so this never double-counts.
const COINS = ["BTC", "ETH", "SOL", "HYPE", "RWA", "Others"];
const sumCoins = (o) => (o ? COINS.reduce((s, c) => s + (o[c] || 0), 0) : 0);
// last COMPLETE UTC day: skip the in-progress current day (its bucket is partial)
const _now = new Date();
const START_TODAY_UTC = Date.UTC(_now.getUTCFullYear(), _now.getUTCMonth(), _now.getUTCDate());
const lastComplete = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i].t < START_TODAY_UTC && sumCoins(arr[i]) > 0) return i; return -1; };
const readJson = async (p) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } };

// Live markets from the RISEx API — fallback for markets the Dune dashboard
// queries don't cover yet (newly listed, e.g. the stock perps). open_interest is
// in base units, quote_volume_24h in USD (mirrors lib/analytics.ts).
async function liveMarkets() {
  try {
    const r = await fetch("https://api.rise.trade/v1/markets");
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.data?.markets || [])
      .filter((m) => m.active)
      .map((m) => ({
        symbol: String(m.base_asset_symbol || "").replace("/USDC", ""),
        oiUsd: Number(m.open_interest || 0) * Number(m.mark_price || 0),
        vol24: Number(m.quote_volume_24h || 0),
      }));
  } catch {
    return [];
  }
}

async function main() {
  const dune = await readJson(join(DATA, "dune.json"));
  const lb = await readJson(join(DATA, "leaderboard.json"));
  const prev = await readJson(OUT);
  const live = await liveMarkets();

  const oiNow = dune?.totals?.oi ?? 0;
  const tvl = dune?.totals?.tvl ?? 0;
  const cumVol = dune?.totals?.cumVolume ?? 0;
  const cumFee = (dune?.fees?.total ?? 0) + (dune?.liqTotals?.fees ?? 0); // trade + liquidation

  // 24h VOLUME — last complete UTC day from Dune + day-over-day delta
  const volDays = dune?.volume || [];
  const vi = lastComplete(volDays);
  const vol24h = vi >= 0 ? sumCoins(volDays[vi]) : 0;
  const volChg = vi > 0 ? sumCoins(volDays[vi]) - sumCoins(volDays[vi - 1]) : 0;

  // 24h FEES (trade+liq) — last complete UTC day + day-over-day delta
  const fd = dune?.feesByMarket || [];
  const ld = dune?.liqFeesByMarket || [];
  const dayFee = (i) => sumCoins(fd[i]) + sumCoins(ld[i]);
  const li = lastComplete(fd);
  const fee24h = li >= 0 ? dayFee(li) : 0;
  const feeChg = li > 0 ? dayFee(li) - dayFee(li - 1) : 0;

  // TVL — current value + day-over-day change of the TVL series
  const tvlSeries = dune?.tvl || [];
  const tvlChg = tvlSeries.length >= 2 ? tvlSeries[tvlSeries.length - 1].tvl - tvlSeries[tvlSeries.length - 2].tvl : 0;

  // RWA breakout split by class — Commodities vs Stocks — out of the crypto
  // totals: OI = live markets from oiByMarket · Vol24h = the class volume band
  // on the last complete day · CumVol = the all-time class aggregate. Older
  // dune.json (pre-split) only has the RWA umbrella — fold it into Commodities.
  // OI prefers Dune's oiByMarket but falls back per-market to the live API for
  // markets Dune doesn't list yet; 24h vol likewise falls back to the live
  // rolling window (≈ the completed UTC day at the 00:00 snapshot) when the
  // Dune band is empty.
  const classStats = (symbols, bandKey, cumKey, cumFallback = 0) => {
    const duneOi = new Map((dune?.oiByMarket || []).map((r) => [r.symbol, r.oiUsd || 0]));
    const liveBy = new Map(live.map((m) => [m.symbol, m]));
    const oi = symbols.reduce((s, sym) => s + (duneOi.get(sym) ?? liveBy.get(sym)?.oiUsd ?? 0), 0);
    const band = (d) => d?.[bandKey] ?? (bandKey === "Commodities" ? d?.RWA : undefined) ?? 0;
    let vol24 = vi >= 0 ? band(volDays[vi]) : 0;
    let volChg = vi > 0 ? band(volDays[vi]) - band(volDays[vi - 1]) : 0;
    if (!vol24) {
      vol24 = symbols.reduce((s, sym) => s + (liveBy.get(sym)?.vol24 ?? 0), 0);
      volChg = 0;
    }
    return {
      oi,
      oiPct: oiNow > 0 ? (oi / oiNow) * 100 : 0,
      vol24,
      volChg,
      // 0 → null so the strip shows "—" while Dune still lacks the class's markets
      cumVol: (dune?.totals?.[cumKey] || cumFallback) || null,
    };
  };
  const cmd = classStats(CMD_SYMBOLS, "Commodities", "cumVolumeCmd", dune?.totals?.cumVolumeRwa ?? 0);
  const stk = classStats(STK_SYMBOLS, "Stocks", "cumVolumeStk");

  // OI — change vs the previous snapshot (no Dune daily history for OI)
  const oiChg = prev?.raw?.oiNow != null ? oiNow - prev.raw.oiNow : 0;

  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const d = (n) => (n ? usd(n, { sign: true }) : undefined);
  const medal = ["🥇", "🥈", "🥉"];
  const mkTop = (rows = [], val) => rows.slice(0, 3).map((r, i) => ({ m: medal[i], a: shortAddr(r.account), v: val(r) }));
  const tops = [
    { title: "Top Volume", rows: mkTop(lb?.byVolume, (r) => usd(r.volume)) },
    { title: "Top Open Interest", rows: mkTop(lb?.byOI, (r) => usd(r.oi)) },
    { title: "Top PnL", rows: mkTop(lb?.byUpnl, (r) => usd(r.uPnl, { sign: true })) },
  ];
  const kpis24 = [
    { label: "Volume", value: usd(vol24h), delta: d(volChg) },
    { label: "Open Interest", value: usd(oiNow), delta: d(oiChg) },
    { label: "Fees (trade + liq)", value: usd(fee24h), delta: d(feeChg) },
    { label: "TVL", value: usd(tvl), delta: d(tvlChg) },
  ];
  const kpisTotal = [
    { label: "Volume", value: usd(cumVol) },
    { label: "Fees (trade + liq)", value: usd(cumFee) },
  ];
  const classKpis = (c) => [
    { label: "OI", value: usd(c.oi), delta: c.oiPct >= 0.05 ? `${c.oiPct.toFixed(1)}% of OI` : undefined },
    { label: "24h Vol", value: usd(c.vol24), delta: d(c.volChg) },
    { label: "Cum Vol", value: usd(c.cumVol) },
  ];
  const kpisCmd = classKpis(cmd);
  const kpisStk = classKpis(stk);
  const dl = (n) => (n ? ` (${usd(n, { sign: true })} 24h)` : "");
  const line = (m) => m.map((x) => `${x.m} ${x.a} (${x.v})`).join("  ");
  const text = [
    `📊 RISEx Daily — ${date} UTC`, ``,
    `24H`,
    `• Volume: ${usd(vol24h)}${dl(volChg)}`,
    `• Open Interest: ${usd(oiNow)}${dl(oiChg)}`,
    `• Fees (trade+liq): ${usd(fee24h)}${dl(feeChg)}`,
    `• TVL: ${usd(tvl)}${dl(tvlChg)}`, ``,
    `ALL-TIME`,
    `• Volume: ${usd(cumVol)}`,
    `• Fees (trade+liq): ${usd(cumFee)}`, ``,
    `🏦 Commodities (metals + oil)`,
    `• Open Interest: ${usd(cmd.oi)}${cmd.oiPct >= 0.05 ? ` (${cmd.oiPct.toFixed(1)}% of OI)` : ""}`,
    `• 24h Volume: ${usd(cmd.vol24)}${dl(cmd.volChg)}`,
    `• Cumulative Vol: ${usd(cmd.cumVol)}`, ``,
    `📈 Stocks`,
    `• Open Interest: ${usd(stk.oi)}${stk.oiPct >= 0.05 ? ` (${stk.oiPct.toFixed(1)}% of OI)` : ""}`,
    `• 24h Volume: ${usd(stk.vol24)}${dl(stk.volChg)}`,
    `• Cumulative Vol: ${usd(stk.cumVol)}`, ``,
    `🏆 Top traders`,
    `Volume:  ${line(tops[0].rows)}`,
    `OI:      ${line(tops[1].rows)}`,
    `PnL:     ${line(tops[2].rows)}`, ``,
    `→ risescreener.com`,
  ].join("\n");

  const out = {
    generatedAt: new Date().toISOString(),
    date,
    raw: { vol24h, oiNow, tvl, fee24h, cumVol, cumFee, cmdOi: cmd.oi, cmdVol24: cmd.vol24, cmdCumVol: cmd.cumVol, stkOi: stk.oi, stkVol24: stk.vol24, stkCumVol: stk.cumVol },
    kpis24, kpisTotal, kpisCmd, kpisStk, tops, text,
  };
  await mkdir(DATA, { recursive: true });
  await writeFile(OUT, JSON.stringify(out));
  console.log(`✅ summary.json · ${date} · vol ${usd(vol24h)} (${usd(volChg, { sign: true })}) · fee ${usd(fee24h)} · tvl ${usd(tvl)} (${usd(tvlChg, { sign: true })})`);
}

main().catch((e) => {
  console.error("summary snapshot failed:", e);
  process.exit(1);
});
