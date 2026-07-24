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
// RWA markets — metals (gold, silver) + crude oil (WTI, Brent). Mirrors lib/sectors.ts.
const RWA_SYMBOLS = ["XAU", "XAG", "CL", "BZ"];
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

async function main() {
  const dune = await readJson(join(DATA, "dune.json"));
  const lb = await readJson(join(DATA, "leaderboard.json"));
  const prev = await readJson(OUT);

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

  // RWA breakout (metals + oil), split out of the crypto totals:
  //   OI  = live RWA markets from oiByMarket · Vol24h = the RWA volume band on the
  //   last complete day · CumVol = the all-time RWA aggregate.
  const rwaOi = (dune?.oiByMarket || []).filter((r) => RWA_SYMBOLS.includes(r.symbol)).reduce((s, r) => s + (r.oiUsd || 0), 0);
  const rwaOiPct = oiNow > 0 ? (rwaOi / oiNow) * 100 : 0;
  const rwaVol24 = vi >= 0 ? (volDays[vi].RWA || 0) : 0;
  const rwaVolChg = vi > 0 ? (volDays[vi].RWA || 0) - (volDays[vi - 1].RWA || 0) : 0;
  const rwaCumVol = dune?.totals?.cumVolumeRwa ?? 0;

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
  const kpisRwa = [
    { label: "OI", value: usd(rwaOi), delta: rwaOiPct >= 0.05 ? `${rwaOiPct.toFixed(1)}% of OI` : undefined },
    { label: "24h Vol", value: usd(rwaVol24), delta: d(rwaVolChg) },
    { label: "Cum Vol", value: usd(rwaCumVol) },
  ];
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
    `🏦 RWA (metals + oil)`,
    `• Open Interest: ${usd(rwaOi)}${rwaOiPct >= 0.05 ? ` (${rwaOiPct.toFixed(1)}% of OI)` : ""}`,
    `• 24h Volume: ${usd(rwaVol24)}${dl(rwaVolChg)}`,
    `• Cumulative Vol: ${usd(rwaCumVol)}`, ``,
    `🏆 Top traders`,
    `Volume:  ${line(tops[0].rows)}`,
    `OI:      ${line(tops[1].rows)}`,
    `PnL:     ${line(tops[2].rows)}`, ``,
    `→ risescreener.com`,
  ].join("\n");

  const out = {
    generatedAt: new Date().toISOString(),
    date,
    raw: { vol24h, oiNow, tvl, fee24h, cumVol, cumFee, rwaOi, rwaVol24, rwaCumVol },
    kpis24, kpisTotal, kpisRwa, tops, text,
  };
  await mkdir(DATA, { recursive: true });
  await writeFile(OUT, JSON.stringify(out));
  console.log(`✅ summary.json · ${date} · vol ${usd(vol24h)} (${usd(volChg, { sign: true })}) · fee ${usd(fee24h)} · tvl ${usd(tvl)} (${usd(tvlChg, { sign: true })})`);
}

main().catch((e) => {
  console.error("summary snapshot failed:", e);
  process.exit(1);
});
