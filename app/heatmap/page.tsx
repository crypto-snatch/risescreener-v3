import { getSnapshot } from "@/lib/snapshot";
import { usd } from "@/lib/format";
import { Panel, Stat, SectionLabel, Empty } from "@/components/ui";

export const revalidate = 30;
export const metadata = { title: "Position Heat Map — RiseScreener" };

const MIN_NOTIONAL = 3000; // hide markets with too little sampled OI (noisy 100% skews)

export default async function HeatMapPage() {
  const snap = await getSnapshot();
  const skew = (snap?.marketSkew ?? []).filter((s) => s.totalUsd >= MIN_NOTIONAL).sort((a, b) => b.totalUsd - a.totalUsd);

  if (!skew.length)
    return (
      <div className="screen" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Position Heat Map</h1>
        <Empty>Skew data not generated yet — run the indexer (`npm run index`).</Empty>
      </div>
    );

  const mostLong = [...skew].sort((a, b) => b.longPct - a.longPct)[0];
  const mostShort = [...skew].sort((a, b) => a.longPct - b.longPct)[0];
  const totLong = skew.reduce((s, m) => s + m.longUsd, 0);
  const totShort = skew.reduce((s, m) => s + m.shortUsd, 0);
  const net = totLong - totShort;

  return (
    <div className="screen" data-page="heatmap" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Position Heat Map</h1>
        <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
          Crowd positioning — open long vs short notional per market
          {snap?.sampled && <span className="chip" title={`Computed from ${snap.scoredAccounts} of ${snap.totalAccounts} accounts. Full index stabilizes these ratios.`} style={{ marginLeft: 8, fontSize: 10 }}>sample · {snap.scoredAccounts}/{snap.totalAccounts} accts</span>}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10 }}>
        <Stat big label="Most crowded long" value={mostLong ? `${mostLong.symbol} ${mostLong.longPct.toFixed(0)}%` : "—"} tone="long" />
        <Stat big label="Most crowded short" value={mostShort ? `${mostShort.symbol} ${(100 - mostShort.longPct).toFixed(0)}%` : "—"} tone="short" />
        <Stat big label="Net bias" value={usd(net, { sign: true })} tone={net >= 0 ? "long" : "short"} hint={net >= 0 ? "net long" : "net short"} />
        <Stat big label="Open notional" value={usd(totLong + totShort)} hint="all markets" />
      </div>

      <div>
        <SectionLabel>Long / short bias · by market</SectionLabel>
        <Panel pad="6px 0">
          {skew.map((m) => (
            <div key={m.symbol} style={{ display: "grid", gridTemplateColumns: "88px 1fr 120px", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: "1px solid var(--hair-soft)" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{m.symbol}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 0, height: 22, borderRadius: 5, overflow: "hidden", background: "var(--glass-2)" }}>
                <span title={`Long ${usd(m.longUsd)}`} style={{ width: `${m.longPct}%`, height: "100%", background: "color-mix(in oklab, var(--long) 78%, transparent)", display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 10.5, color: "#06120d", fontWeight: 600 }}>
                  {m.longPct >= 14 ? `${m.longPct.toFixed(0)}%` : ""}
                </span>
                <span title={`Short ${usd(m.shortUsd)}`} style={{ width: `${100 - m.longPct}%`, height: "100%", background: "color-mix(in oklab, var(--short) 74%, transparent)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, fontSize: 10.5, color: "#160607", fontWeight: 600 }}>
                  {100 - m.longPct >= 14 ? `${(100 - m.longPct).toFixed(0)}%` : ""}
                </span>
              </span>
              <span className="tnum" style={{ textAlign: "right", fontSize: 12, color: "var(--muted)" }}>{usd(m.totalUsd)}</span>
            </div>
          ))}
        </Panel>
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "var(--muted-2)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--long)" }} /> Long</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--short)" }} /> Short</span>
          <span>· notional = open interest by side, from indexed positions · markets under ${MIN_NOTIONAL.toLocaleString()} OI hidden</span>
        </div>
      </div>
    </div>
  );
}
