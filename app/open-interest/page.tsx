import { getMarketRows, getProtocol, isUpcoming } from "@/lib/analytics";
import { getTimeseries } from "@/lib/timeseries";
import { getDune } from "@/lib/dune";
import { usd, price } from "@/lib/format";
import { Stat, SectionLabel, Panel, Empty } from "@/components/ui";
import SeriesChart from "@/components/SeriesChart";
import ChartCard from "@/components/ChartCard";
import { Donut } from "@/components/charts";
import { categoryOf, CAT_COLOR } from "@/lib/sectors";

export const revalidate = 30;
export const metadata = { title: "Open Interest — RiseScreener" };

const PALETTE = ["#f7931a", "#8aa0c8", "#34cfa2", "#14f195", "#c79bff", "#e8737f", "#e6c069", "#5fb0d6"];

export default async function OpenInterestPage() {
  const [rows, p, ts, dune] = await Promise.all([getMarketRows(), getProtocol(), getTimeseries(), getDune()]);
  const tradable = rows.filter((r) => !isUpcoming(r)).sort((a, b) => b.oiUsd - a.oiUsd);
  const totalOi = dune?.totals.oi ?? tradable.reduce((s, r) => s + r.oiUsd, 0);
  const top = tradable[0];
  const avgUtil = tradable.length ? tradable.reduce((s, r) => s + r.oiUtilPct, 0) / tradable.length : 0;

  // market-share donut: top 7 + Others
  const shareTop = tradable.slice(0, 7).map((r, i) => ({ name: r.symbol, value: r.oiUsd, color: PALETTE[i % PALETTE.length] }));
  const restOi = tradable.slice(7).reduce((s, r) => s + r.oiUsd, 0);
  const share = restOi > 0 ? [...shareTop, { name: "Others", value: restOi, color: "#6a7c8e" }] : shareTop;
  const shareTot = share.reduce((s, x) => s + x.value, 0) || 1;
  const shareLegend = share.map((x) => ({ name: x.name, color: x.color, value: usd(x.value), pct: (x.value / shareTot) * 100 }));

  // OI over time (from our timeseries snapshots)
  const oiTs = ts.map((pt) => ({ t: pt.t, ...pt.oi }));

  return (
    <div className="screen" data-page="open-interest" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Open Interest</h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>Open interest across RISEx markets — live, by market &amp; over time</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 10 }}>
        <Stat big label="Total open interest" value={usd(totalOi)} tone="accent" />
        <Stat big label="Largest market" value={top ? top.symbol : "—"} hint={top ? usd(top.oiUsd) : ""} />
        <Stat big label="Avg OI utilization" value={`${avgUtil.toFixed(1)}%`} hint="OI ÷ OI cap" />
        <Stat big label="Active markets" value={String(tradable.length)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))", gap: 16, alignItems: "stretch" }}>
        <SeriesChart title="Open interest over time" points={oiTs} mode="lines" extraKey="total" extraLabel="Total OI" />
        <ChartCard title="OI market share" height={300} legend={shareLegend} filename="risescreener-oi-share">
          {share.length ? <Donut data={share} height="100%" /> : <Empty>No data.</Empty>}
        </ChartCard>
      </div>

      <div>
        <SectionLabel>Open interest by market</SectionLabel>
        <Panel style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                <Th>Market</Th><Th>Sector</Th><Th right>Mark</Th><Th right>Open Interest</Th><Th right>Share</Th><Th right>OI utilization</Th><Th right>24h</Th>
              </tr>
            </thead>
            <tbody>
              {tradable.map((r) => {
                const cat = categoryOf(r.symbol); const col = CAT_COLOR[cat];
                return (
                  <tr key={r.marketId} style={{ borderBottom: "1px solid var(--hair-soft)" }}>
                    <Td><span style={{ fontWeight: 600 }}>{r.symbol}</span></Td>
                    <Td>{col ? <span className="chip" style={{ fontSize: 10, padding: "2px 8px", color: col, borderColor: `color-mix(in oklab, ${col} 34%, transparent)`, background: `color-mix(in oklab, ${col} 12%, transparent)` }}>{cat}</span> : <span style={{ color: "var(--muted-2)" }}>{cat}</span>}</Td>
                    <Td right mono>${price(r.mark)}</Td>
                    <Td right mono>{usd(r.oiUsd)}</Td>
                    <Td right mono color="var(--muted)">{((r.oiUsd / (totalOi || 1)) * 100).toFixed(1)}%</Td>
                    <Td right><UtilCell pct={r.oiUtilPct} /></Td>
                    <Td right mono color={r.changePct >= 0 ? "var(--long)" : "var(--short)"}>{r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(2)}%</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

function UtilCell({ pct }: { pct: number }) {
  const c = pct > 85 ? "var(--short)" : pct > 60 ? "var(--warn)" : "var(--accent-ink)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
      <span style={{ width: 44, height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${Math.min(100, pct)}%`, background: c }} />
      </span>
      <span className="tnum" style={{ color: c, minWidth: 34, textAlign: "right" }}>{pct.toFixed(0)}%</span>
    </span>
  );
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontWeight: 400, padding: "11px 14px", textAlign: right ? "right" : "left", color: "var(--muted-2)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid var(--hair)" }}>{children}</th>;
}
function Td({ children, right, mono, color }: { children: React.ReactNode; right?: boolean; mono?: boolean; color?: string }) {
  return <td className={mono ? "tnum" : undefined} style={{ padding: "10px 14px", textAlign: right ? "right" : "left", whiteSpace: "nowrap", color: color || "var(--ink)" }}>{children}</td>;
}
