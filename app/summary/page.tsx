import { getProtocol } from "@/lib/analytics";
import { getDune } from "@/lib/dune";
import { getSnapshot } from "@/lib/snapshot";
import { getTimeseries } from "@/lib/timeseries";
import { getSummary } from "@/lib/summary";
import { usd, shortAddr } from "@/lib/format";
import { CMD_SYMBOLS, STOCK_SYMBOLS } from "@/lib/sectors";
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
        <SummaryShare date={snap.date} kpis24={snap.kpis24} kpisTotal={snap.kpisTotal} kpisRwa={snap.kpisRwa} kpisCmd={snap.kpisCmd} kpisStk={snap.kpisStk} tops={snap.tops} text={snap.text} />
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

  // RWA breakout by class — Commodities vs Stocks — split out of the crypto
  // totals. Older dune.json (pre-split) only has the RWA umbrella band — fold
  // it into Commodities. Mirrors scripts/snapshot-summary.mjs.
  const classStats = (symbols: string[], bandKey: "Commodities" | "Stocks", cum: number) => {
    const oi = (dune?.oiByMarket ?? []).filter((r) => symbols.includes(r.symbol)).reduce((s, r) => s + (r.oiUsd || 0), 0);
    const band = (d?: (typeof volDays)[number]) => d?.[bandKey] ?? (bandKey === "Commodities" ? d?.RWA : undefined) ?? 0;
    return {
      oi,
      oiPct: oiNow > 0 ? (oi / oiNow) * 100 : 0,
      vol24: vi >= 0 ? band(volDays[vi]) : 0,
      volChg: vi > 0 ? band(volDays[vi]) - band(volDays[vi - 1]) : 0,
      cumVol: cum,
    };
  };
  const cmd = classStats(CMD_SYMBOLS, "Commodities", dune?.totals.cumVolumeCmd ?? dune?.totals.cumVolumeRwa ?? 0);
  const stk = classStats(STOCK_SYMBOLS, "Stocks", dune?.totals.cumVolumeStk ?? 0);

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
  const classKpis = (c: typeof cmd): NonNullable<ShareProps["kpisCmd"]> => [
    { label: "OI", value: usd(c.oi), delta: c.oiPct >= 0.05 ? `${c.oiPct.toFixed(1)}% of OI` : undefined },
    { label: "24h Vol", value: usd(c.vol24), delta: d(c.volChg) },
    { label: "Cum Vol", value: usd(c.cumVol) },
  ];
  const kpisCmd = classKpis(cmd);
  const kpisStk = classKpis(stk);

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

  return (
    <Frame>
      <SummaryShare date={date} kpis24={kpis24} kpisTotal={kpisTotal} kpisCmd={kpisCmd} kpisStk={kpisStk} tops={tops} text={text} />
    </Frame>
  );
}
