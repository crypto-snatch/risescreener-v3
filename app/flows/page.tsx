import { getFlows } from "@/lib/flows";
import { getTvl } from "@/lib/analytics";
import { getDune } from "@/lib/dune";
import { usd, shortAddr, timeAgo } from "@/lib/format";
import { EXPLORER_UI } from "@/lib/constants";
import { Panel, Stat, SectionLabel, Empty } from "@/components/ui";
import ChartCard from "@/components/ChartCard";
import { AreaTrend, Bars } from "@/components/charts";

export const revalidate = 30;
export const metadata = { title: "Flows — RiseScreener" };

export default async function FlowsPage() {
  const [f, tvl, dune] = await Promise.all([getFlows(), getTvl(), getDune()]);
  const tvlSeries = (dune?.tvl ?? []).map((p) => ({ t: p.t, v: p.tvl }));
  const netSeries = (dune?.tvl ?? []).slice(-30).map((p) => ({ label: new Date(p.t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }), v: Math.round(p.net) }));
  const cumDep = (dune?.tvl ?? []).reduce((s, p) => s + (p.deposits || 0), 0);
  const cumWit = (dune?.tvl ?? []).reduce((s, p) => s + (p.withdrawals || 0), 0);

  return (
    <div className="screen" data-page="flows" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Flows</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
        <Stat big label="TVL (collateral)" value={usd(tvl)} tone="accent" />
        <Stat big label="24h deposits" value={usd(f.deposit24h)} tone="long" />
        <Stat big label="24h withdrawals" value={usd(f.withdraw24h)} tone="short" />
        <Stat big label="24h net flow" value={usd(f.net24h, { sign: true })} tone={f.net24h >= 0 ? "long" : "short"} />
        <Stat big label="Cumulative net" value={usd(cumDep - cumWit, { sign: true })} tone={cumDep - cumWit >= 0 ? "long" : "short"} hint="all-time deposits − withdrawals" />
      </div>

      {(tvlSeries.length > 1 || netSeries.length > 1) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))", gap: 16, alignItems: "stretch" }}>
          <ChartCard title="TVL over time" height={280} filename="risescreener-tvl">
            {tvlSeries.length > 1 ? <AreaTrend data={tvlSeries} xKey="t" yKey="v" yPreset="usd" valueName="TVL" height="100%" /> : <Empty>No data.</Empty>}
          </ChartCard>
          <ChartCard title="Net flow · daily (30d)" height={280} filename="risescreener-net-flow">
            {netSeries.length > 1 ? <Bars data={netSeries} xKey="label" yKey="v" colorBySign height={280} /> : <Empty>No data.</Empty>}
          </ChartCard>
        </div>
      )}

      <Panel style={{ overflowX: "auto" }}>
        <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--hair)", fontWeight: 700, fontSize: 13 }}>Recent collateral flows</div>
        <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr><Th>Type</Th><Th>Account</Th><Th right>Amount</Th><Th right>Age</Th><Th>Tx</Th></tr>
          </thead>
          <tbody>
            {f.recent.length === 0 && (
              <tr><td colSpan={5} style={{ padding: "26px", textAlign: "center", color: "var(--muted)" }}>No recent flows.</td></tr>
            )}
            {f.recent.map((x, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--hair-soft)" }}>
                <Td><span style={{ color: x.type === "deposit" ? "var(--long)" : "var(--short)", fontWeight: 600 }}>{x.type === "deposit" ? "DEPOSIT" : "WITHDRAW"}</span></Td>
                <Td><a className="mono-link" href={`/address/${x.account}`}>{x.account ? shortAddr(x.account) : "—"}</a></Td>
                <Td right mono>{usd(x.amount)}</Td>
                <Td right mono color="var(--muted)">{x.timeMs ? timeAgo(x.timeMs) : "—"}</Td>
                <Td><a className="mono-link" href={`${EXPLORER_UI}/tx/${x.txHash}`} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>{x.txHash ? x.txHash.slice(0, 8) + "…" : "—"}</a></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <p style={{ fontSize: 11, color: "var(--muted-2)" }}>Deposits/withdrawals decoded from CollateralManager events. TVL trend chart builds from periodic snapshots (timeseries cron).</p>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontWeight: 400, padding: "11px 12px", textAlign: right ? "right" : "left", color: "var(--muted-2)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid var(--hair)" }}>{children}</th>;
}
function Td({ children, right, mono, color }: { children: React.ReactNode; right?: boolean; mono?: boolean; color?: string }) {
  return <td style={{ padding: "9px 12px", textAlign: right ? "right" : "left", whiteSpace: "nowrap", color: color || "var(--ink)", fontVariantNumeric: mono ? "tabular-nums" : "normal" }}>{children}</td>;
}
