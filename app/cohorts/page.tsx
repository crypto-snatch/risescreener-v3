import { getSnapshot } from "@/lib/snapshot";
import { usd, compact } from "@/lib/format";
import { Panel, Stat, SectionLabel, Empty } from "@/components/ui";
import ChartCard from "@/components/ChartCard";
import { Donut } from "@/components/charts";

const TIER_COLOR: Record<string, string> = { shrimp: "#6a7c8e", fish: "#5fb0d6", dolphin: "#7d93c8", shark: "#c79bff", whale: "#34cfa2" };

export const revalidate = 30;
export const metadata = { title: "Cohorts — RiseScreener" };

function BiasBar({ longUsd, shortUsd }: { longUsd: number; shortUsd: number }) {
  const t = longUsd + shortUsd;
  const lp = t > 0 ? (longUsd / t) * 100 : 50;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end", width: "100%" }}>
      <span className="tnum" style={{ color: "var(--long)", fontSize: 11, minWidth: 30, textAlign: "right" }}>{lp.toFixed(0)}%</span>
      <span style={{ width: 90, height: 6, borderRadius: 3, overflow: "hidden", display: "inline-flex", background: "var(--short)" }}>
        <span style={{ width: `${lp}%`, background: "var(--long)" }} />
      </span>
      <span className="tnum" style={{ color: "var(--short)", fontSize: 11, minWidth: 30 }}>{(100 - lp).toFixed(0)}%</span>
    </span>
  );
}

export default async function CohortsPage() {
  const snap = await getSnapshot();
  const cohorts = snap?.cohorts ?? [];

  if (!cohorts.length)
    return (
      <div className="screen" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Cohorts</h1>
        <Empty>Cohort data not generated yet — run the indexer (`npm run index`).</Empty>
      </div>
    );

  const tracked = cohorts.reduce((s, c) => s + c.count, 0);
  const aggEquity = cohorts.reduce((s, c) => s + c.equity, 0);
  const totLong = cohorts.reduce((s, c) => s + c.longUsd, 0);
  const totShort = cohorts.reduce((s, c) => s + c.shortUsd, 0);
  const net = totLong - totShort;

  const equityDonut = cohorts.map((c) => ({ name: c.label.split(" ")[0], value: c.equity, color: TIER_COLOR[c.tier] ?? "#6a7c8e" })).filter((x) => x.value > 0);
  const eqTot = equityDonut.reduce((s, x) => s + x.value, 0) || 1;
  const equityLegend = equityDonut.map((x) => ({ name: x.name, color: x.color, value: usd(x.value), pct: (x.value / eqTot) * 100 }));
  const notionalDonut = cohorts.map((c) => ({ name: c.label.split(" ")[0], value: c.longUsd + c.shortUsd, color: TIER_COLOR[c.tier] ?? "#6a7c8e" })).filter((x) => x.value > 0);
  const notTot = notionalDonut.reduce((s, x) => s + x.value, 0) || 1;
  const notionalLegend = notionalDonut.map((x) => ({ name: x.name, color: x.color, value: usd(x.value), pct: (x.value / notTot) * 100 }));
  const maxCount = Math.max(1, ...cohorts.map((c) => c.count));

  return (
    <div className="screen" data-page="cohorts" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Cohorts</h1>
        <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
          Trader segments by account equity · derived from the account indexer
          {snap?.sampled && <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>sampled · {compact(snap.scoredAccounts ?? 0)} of {compact(snap.totalAccounts)}</span>}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 10 }}>
        <Stat big label="Tracked wallets" value={compact(tracked)} hint="across 5 cohorts" />
        <Stat big label="Aggregate equity" value={usd(aggEquity)} tone="accent" hint="perp collateral + uPnL" />
        <Stat big label="Net market bias" value={usd(net, { sign: true })} tone={net >= 0 ? "long" : "short"} hint={net >= 0 ? "net long" : "net short"} />
        <Stat big label="Open notional" value={usd(totLong + totShort)} hint="long + short" />
      </div>

      {/* cohort analytics charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 16, alignItems: "stretch" }}>
        <ChartCard title="Equity share by cohort" height={250} legend={equityLegend} filename="risescreener-cohort-equity">
          {equityDonut.length ? <Donut data={equityDonut} height="100%" /> : <Empty>No data.</Empty>}
        </ChartCard>
        <ChartCard title="Open notional by cohort" height={250} legend={notionalLegend} filename="risescreener-cohort-notional">
          {notionalDonut.length ? <Donut data={notionalDonut} height="100%" /> : <Empty>No data.</Empty>}
        </ChartCard>
        <div className="glass glow-edge glass-raise" style={{ borderRadius: "var(--r-lg)", padding: "14px 16px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Wallets by cohort</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, justifyContent: "center" }}>
            {cohorts.map((c) => (
              <div key={c.tier} style={{ display: "grid", gridTemplateColumns: "78px 1fr 52px", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{c.label.split(" ")[0]}</span>
                <span style={{ height: 14, borderRadius: 4, background: "var(--glass-2)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${(c.count / maxCount) * 100}%`, background: TIER_COLOR[c.tier], borderRadius: 4 }} />
                </span>
                <span className="tnum" style={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>{compact(c.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Trader cohorts · segmented by perp equity</SectionLabel>
        <Panel style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr>
                <Th>Cohort</Th>
                <Th right>Wallets</Th>
                <Th right>Aggregate equity</Th>
                <Th right>Avg equity</Th>
                <Th right>Long ↔ Short</Th>
                <Th right>Net bias</Th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => {
                const cnet = c.longUsd - c.shortUsd;
                return (
                  <tr key={c.tier} style={{ borderBottom: "1px solid var(--hair-soft)" }}>
                    <Td><span style={{ fontWeight: 600 }}>{c.label}</span></Td>
                    <Td right mono>{compact(c.count)}</Td>
                    <Td right mono>{usd(c.equity)}</Td>
                    <Td right mono>{usd(c.count ? c.equity / c.count : 0)}</Td>
                    <Td right><BiasBar longUsd={c.longUsd} shortUsd={c.shortUsd} /></Td>
                    <Td right mono color={cnet >= 0 ? "var(--long)" : "var(--short)"}>{usd(cnet, { sign: true })}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        <p style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 10 }}>
          Equity = cross-margin collateral + unrealized PnL. Bias from open long vs short notional across each segment.
        </p>
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontWeight: 400, padding: "11px 14px", textAlign: right ? "right" : "left", color: "var(--muted-2)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid var(--hair)" }}>{children}</th>;
}
function Td({ children, right, mono, color }: { children: React.ReactNode; right?: boolean; mono?: boolean; color?: string }) {
  return <td className={mono ? "tnum" : undefined} style={{ padding: "11px 14px", textAlign: right ? "right" : "left", whiteSpace: "nowrap", color: color || "var(--ink)" }}>{children}</td>;
}
