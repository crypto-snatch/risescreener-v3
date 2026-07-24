import { getProtocol } from "@/lib/analytics";
import { getDune } from "@/lib/dune";
import { getSnapshot } from "@/lib/snapshot";
import { getTimeseries } from "@/lib/timeseries";
import { getSummary } from "@/lib/summary";
import { usd, shortAddr } from "@/lib/format";
import { RWA_SYMBOLS } from "@/lib/sectors";
import SummaryShare from "@/components/SummaryShare";

export const revalidate = 60;
export const metadata = { title: "Summary — RiseScreener" };

// "RWA" is the per-day aggregate volume band (not folded into "Others"), so it is
// summed here to keep the volume total whole; fee CoinDays leave RWA at 0, so it
// never double-counts fees. Mirrors scripts/snapshot-summary.mjs.
const COINS = ["BTC", "ETH", "SOL", "HYPE", "RWA", "Others"] as const;
const sumCoins = (o?: Partial<Record<(typeof COINS)[number], number>>) =>
  o ? COINS.reduce((s, c) => s + (o[c] || 0), 0) : 0;

type ShareProps = Parameters<typeof SummaryShare>[0];

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="screen" data-page="summary" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Summary</h1>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
          A daily recap, frozen at 00:00 UTC — download/copy the card for Twitter/Telegram, or copy the text on the right.
        </p>
      </div>
      {children}
    </div>
  );
}

export default async function SummaryPage() {
  // Prefer the daily 00:00 snapshot; fall back to a live computation.
  const snap = await getSummary();
  if (snap) {
    return (
      <Frame>
        <SummaryShare date={snap.date} kpis24={snap.kpis24} kpisTotal={snap.kpisTotal} kpisRwa={snap.kpisRwa} tops={snap.tops} text={snap.text} />
      </Frame>
    );
  }

  const [p, dune, lb, ts] = await Promise.all([getProtocol(), getDune(), getSnapshot(), getTimeseries()]);

  const oiNow = dune?.totals.oi ?? p.totalOiUsd;
  const tvl = dune?.totals.tvl ?? p.tvl;
  const cumVol = dune?.totals.cumVolume ?? 0;
  const cumFee = (dune?.fees.total ?? 0) + (dune?.liqTotals.fees ?? 0);
  // last COMPLETE UTC day: skip the in-progress current day (its bucket is partial)
  const now = new Date();
  const startTodayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const lastComplete = (arr: { t: number }[]) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i].t < startTodayUTC && sumCoins(arr[i] as Record<string, number>)) return i; return -1; };

  // Volume — last complete UTC day from Dune + day-over-day delta
  const volDays = dune?.volume ?? [];
  const vi = lastComplete(volDays);
  const vol24h = vi >= 0 ? sumCoins(volDays[vi]) : p.totalVolume24h;
  const volChg = vi > 0 ? sumCoins(volDays[vi]) - sumCoins(volDays[vi - 1]) : 0;

  // Fees (trade+liq) — last complete UTC day + day-over-day delta
  const feeDays = dune?.feesByMarket ?? [];
  const liqDays = dune?.liqFeesByMarket ?? [];
  const dayFee = (i: number) => sumCoins(feeDays[i]) + sumCoins(liqDays[i]);
  const li = lastComplete(feeDays);
  const fee24h = li >= 0 ? dayFee(li) : 0;
  const feeChg = li > 0 ? dayFee(li) - dayFee(li - 1) : 0;

  // TVL — current + day-over-day change of the TVL series
  const tvlSeries = dune?.tvl ?? [];
  const tvlChg = tvlSeries.length >= 2 ? tvlSeries[tvlSeries.length - 1].tvl - tvlSeries[tvlSeries.length - 2].tvl : 0;

  // OI — change vs ~24h ago from our timeseries (no Dune daily OI history)
  let base: (typeof ts)[number] | null = null;
  if (ts.length) {
    const target = Date.now() - 24 * 3600 * 1000;
    base = ts[0];
    for (const x of ts) if (Math.abs(x.t - target) < Math.abs(base.t - target)) base = x;
  }
  const oiChg = base && sumCoins(base.oi) ? oiNow - sumCoins(base.oi) : 0;

  // RWA breakout (metals + oil), split out of the crypto totals.
  const rwaOi = (dune?.oiByMarket ?? []).filter((r) => RWA_SYMBOLS.includes(r.symbol)).reduce((s, r) => s + (r.oiUsd || 0), 0);
  const rwaOiPct = oiNow > 0 ? (rwaOi / oiNow) * 100 : 0;
  const rwaVol24 = vi >= 0 ? (volDays[vi].RWA || 0) : 0;
  const rwaVolChg = vi > 0 ? (volDays[vi].RWA || 0) - (volDays[vi - 1].RWA || 0) : 0;
  const rwaCumVol = dune?.totals.cumVolumeRwa ?? 0;

  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const d = (n: number) => (n ? usd(n, { sign: true }) : undefined);

  const medal = ["🥇", "🥈", "🥉"];
  const mkTop = (rows: { account: string }[] = [], val: (r: any) => string) =>
    rows.slice(0, 3).map((r, i) => ({ m: medal[i], a: shortAddr(r.account), v: val(r) }));
  const tops = [
    { title: "Top Volume", rows: mkTop(lb?.byVolume, (r) => usd(r.volume)) },
    { title: "Top Open Interest", rows: mkTop(lb?.byOI, (r) => usd(r.oi)) },
    { title: "Top PnL", rows: mkTop(lb?.byUpnl, (r) => usd(r.uPnl, { sign: true })) },
  ];

  const kpis24: ShareProps["kpis24"] = [
    { label: "Volume", value: usd(vol24h), delta: d(volChg) },
    { label: "Open Interest", value: usd(oiNow), delta: d(oiChg) },
    { label: "Fees (trade + liq)", value: usd(fee24h), delta: d(feeChg) },
    { label: "TVL", value: usd(tvl), delta: d(tvlChg) },
  ];
  const kpisTotal: ShareProps["kpisTotal"] = [
    { label: "Volume", value: usd(cumVol) },
    { label: "Fees (trade + liq)", value: usd(cumFee) },
  ];
  const kpisRwa: ShareProps["kpisRwa"] = [
    { label: "OI", value: usd(rwaOi), delta: rwaOiPct >= 0.05 ? `${rwaOiPct.toFixed(1)}% of OI` : undefined },
    { label: "24h Vol", value: usd(rwaVol24), delta: d(rwaVolChg) },
    { label: "Cum Vol", value: usd(rwaCumVol) },
  ];

  const dl = (n: number) => (n ? ` (${usd(n, { sign: true })} 24h)` : "");
  const line = (m: { m: string; a: string; v: string }[]) => m.map((x) => `${x.m} ${x.a} (${x.v})`).join("  ");
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

  return (
    <Frame>
      <SummaryShare date={date} kpis24={kpis24} kpisTotal={kpisTotal} kpisRwa={kpisRwa} tops={tops} text={text} />
    </Frame>
  );
}
