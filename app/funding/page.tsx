import { getMarketRows, isUpcoming, type MarketRow } from "@/lib/analytics";
import { usd, price } from "@/lib/format";
import { Panel, Stat, SectionLabel, Empty } from "@/components/ui";
import ChartCard from "@/components/ChartCard";
import { Bars } from "@/components/charts";
import { CarryOpportunityLadder, type CarryOpportunity } from "@/components/QuantViz";
import { getFundingHistory } from "@/lib/market-data";
import FundingHistoryChart, { type FundingHistorySeries } from "@/components/FundingHistoryChart";

export const revalidate = 15;
export const metadata = { title: "Funding — RiseScreener" };

const pct = (f: number, dp = 4) => `${f >= 0 ? "+" : "−"}${(Math.abs(f) * 100).toFixed(dp)}%`;
const apr = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
// Funding colors follow the mathematical sign everywhere: positive = green
// (longs pay shorts), negative = red (shorts pay longs).
const tone = (v: number) => (v > 0 ? "var(--long)" : v < 0 ? "var(--short)" : "var(--muted)");

function nextIn(ms: number): string {
  const d = ms - Date.now();
  if (!ms || d <= 0) return "—";
  const h = Math.floor(d / 3_600_000);
  const m = Math.floor((d % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function FundingPage() {
  const rows = (await getMarketRows()).filter((r) => !isUpcoming(r));
  const byApr = [...rows].sort((a, b) => b.fundingApr - a.fundingApr);
  const top = byApr[0];
  const bottom = byApr[byApr.length - 1];
  const avg = rows.length ? rows.reduce((s, r) => s + r.fundingApr, 0) / rows.length : 0;
  const longsPay = rows.filter((r) => r.funding8h > 0).length;
  const curveRows = [...rows].sort((a, b) => Math.abs(b.fundingApr) - Math.abs(a.fundingApr)).slice(0, 6);
  const fundingHistories = await Promise.all(
    curveRows.map((row) => getFundingHistory(row.marketId, 72).catch(() => [])),
  );
  const historySeries: FundingHistorySeries[] = curveRows.map((row, index) => ({
    name: row.symbol,
    points: fundingHistories[index].map((point) => ({ t: point.t, ratePct: point.rate * 100 })),
  }));
  const carry: CarryOpportunity[] = rows.map((row) => {
    const positive = row.funding8h >= 0;
    const remainingCapacity = Math.max(0, (row.oiLimitTokens - row.oiTokens) * row.mark);
    const capacityCeiling = row.oiLimitTokens > 0 ? remainingCapacity : row.volume24h * 0.02;
    const capacity = Math.max(0, Math.min(capacityCeiling, row.volume24h * 0.08));
    const riskScore = Math.min(100, row.oiUtilPct * 0.55 + Math.abs(row.basisPct) * 70 + Math.min(30, Math.abs(row.fundingApr) * 0.12));
    return {
      market: row.symbol,
      longVenue: positive ? "Spot hedge" : "RISEx",
      shortVenue: positive ? "RISEx" : "Spot hedge",
      longFundingPct: positive ? 0 : Math.abs(row.funding8h * 100),
      shortFundingPct: positive ? Math.abs(row.funding8h * 100) : 0,
      netAprPct: Math.abs(row.fundingApr),
      capacityUsd: capacity,
      risk: riskScore,
    };
  });

  return (
    <div className="screen" data-page="funding" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Funding</h1>
        <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
          Live funding across {rows.length} markets · positive = longs pay shorts
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 10 }}>
        <Stat big label="Highest APR" value={top ? apr(top.fundingApr) : "—"} tone="long" hint={top ? `${top.symbol} · longs pay` : undefined} />
        <Stat big label="Lowest APR" value={bottom ? apr(bottom.fundingApr) : "—"} tone="short" hint={bottom ? `${bottom.symbol} · shorts pay` : undefined} />
        <Stat big label="Average APR" value={apr(avg)} />
        <Stat big label="Longs pay / Shorts pay" value={`${longsPay} / ${rows.length - longsPay}`} hint="by 8h funding sign" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))", gap: 16 }}>
        <FundingHistoryChart series={historySeries} />
        <ChartCard
          title="Delta-neutral carry ladder"
          subtitle="Indicative hedge capacity · fees and slippage excluded"
          height={320}
          modalHeight={480}
          filename="risescreener-carry-ladder"
        >
          <CarryOpportunityLadder items={carry} maxRows={7} />
        </ChartCard>
      </div>

      <div>
        <SectionLabel>Funding APR by market · green positive = longs pay shorts</SectionLabel>
        <ChartCard title="Funding APR (annualized %)" height={280} filename="risescreener-funding-apr">
          {byApr.length ? <Bars data={byApr.map((r) => ({ label: r.symbol, v: Number(r.fundingApr.toFixed(1)) }))} yKey="v" xKey="label" colorBySign height={280} /> : <Empty>No data.</Empty>}
        </ChartCard>
      </div>

      <div>
        <SectionLabel>Funding board · sorted by APR</SectionLabel>
        <Panel style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <Th>Market</Th>
                <Th right>Mark</Th>
                <Th right>Funding</Th>
                <Th right>8h</Th>
                <Th right>APR</Th>
                <Th right>Open Interest</Th>
                <Th right>Next</Th>
              </tr>
            </thead>
            <tbody>
              {byApr.map((r: MarketRow) => (
                <tr key={r.marketId} style={{ borderBottom: "1px solid var(--hair-soft)" }}>
                  <Td><span style={{ fontWeight: 600 }}>{r.symbol}</span></Td>
                  <Td right mono>{price(r.mark)}</Td>
                  <Td right mono color={tone(r.fundingCur)}>{pct(r.fundingCur)}</Td>
                  <Td right mono color={tone(r.funding8h)}>{pct(r.funding8h)}</Td>
                  <Td right mono color={tone(r.fundingApr)}><b>{apr(r.fundingApr)}</b></Td>
                  <Td right mono>{usd(r.oiUsd)}</Td>
                  <Td right mono color="var(--muted)">{nextIn(r.nextFundingMs)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <p style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 10 }}>
          APR annualized from the 8h funding rate (×3/day × 365). Funding is charged per interval to the crowded side.
        </p>
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontWeight: 400, padding: "11px 14px", textAlign: right ? "right" : "left", color: "var(--muted-2)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid var(--hair)", position: "sticky", top: 0 }}>{children}</th>;
}
function Td({ children, right, mono, color }: { children: React.ReactNode; right?: boolean; mono?: boolean; color?: string }) {
  return <td className={mono ? "tnum" : undefined} style={{ padding: "10px 14px", textAlign: right ? "right" : "left", whiteSpace: "nowrap", color: color || "var(--ink)" }}>{children}</td>;
}
