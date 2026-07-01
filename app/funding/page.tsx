import { getMarketRows, type MarketRow } from "@/lib/analytics";
import { usd, price } from "@/lib/format";
import { Panel, Stat, SectionLabel, Empty } from "@/components/ui";
import ChartCard from "@/components/ChartCard";
import { Bars } from "@/components/charts";

export const revalidate = 15;
export const metadata = { title: "Funding — RiseScreener" };

const pct = (f: number, dp = 4) => `${f >= 0 ? "+" : "−"}${(Math.abs(f) * 100).toFixed(dp)}%`;
const apr = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
const tone = (v: number) => (v > 0 ? "var(--short)" : v < 0 ? "var(--long)" : "var(--muted)");

function nextIn(ms: number): string {
  const d = ms - Date.now();
  if (!ms || d <= 0) return "—";
  const h = Math.floor(d / 3_600_000);
  const m = Math.floor((d % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function FundingPage() {
  const rows = (await getMarketRows()).filter((r) => r.mark > 0);
  const byApr = [...rows].sort((a, b) => b.fundingApr - a.fundingApr);
  const top = byApr[0];
  const bottom = byApr[byApr.length - 1];
  const avg = rows.length ? rows.reduce((s, r) => s + r.fundingApr, 0) / rows.length : 0;
  const longsPay = rows.filter((r) => r.funding8h > 0).length;

  return (
    <div className="screen" data-page="funding" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Funding</h1>
        <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
          Live funding across {rows.length} markets · positive = longs pay shorts
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 10 }}>
        <Stat big label="Highest APR" value={top ? apr(top.fundingApr) : "—"} tone="short" hint={top?.symbol} />
        <Stat big label="Lowest APR" value={bottom ? apr(bottom.fundingApr) : "—"} tone="long" hint={bottom?.symbol} />
        <Stat big label="Average APR" value={apr(avg)} />
        <Stat big label="Longs pay / Shorts pay" value={`${longsPay} / ${rows.length - longsPay}`} hint="by 8h funding sign" />
      </div>

      <div>
        <SectionLabel>Funding APR by market · positive = longs pay shorts</SectionLabel>
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
                <Th right>Predicted</Th>
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
                  <Td right mono color={tone(r.fundingPredicted)}>{pct(r.fundingPredicted)}</Td>
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
