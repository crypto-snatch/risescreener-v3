import { getChainStats } from "@/lib/chain";
import { compact } from "@/lib/format";
import { Panel, Stat, SectionLabel } from "@/components/ui";
import RiseFlow from "@/components/RiseFlow";

export const revalidate = 15;
export const metadata = { title: "Network — RiseScreener" };

const FACTS: [string, string, string][] = [
  ["Type", "Ethereum L2", "based rollup, settles to Ethereum"],
  ["Execution", "pEVM", "parallel EVM across CPU cores"],
  ["Block time", "~1s", "full block + state root"],
  ["Preconfirmation", "~2ms", "shreds (sub-blocks)"],
  ["Throughput", "Gigagas", "target ~55 Ggas/s · ~100k TPS"],
  ["Settlement", "Ethereum", "L1 security"],
];

export default async function NetworkPage() {
  const s = await getChainStats().catch(() => null);
  const tps = s ? s.txToday / 86400 : 0;

  return (
    <div className="screen" data-page="network" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Network</h1>

      {/* intro / what is RISE */}
      <Panel className="glass-2" pad="18px 20px" style={{ borderRadius: "var(--r-lg)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>RISE — the trading chain</div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6, maxWidth: 820 }}>
          RISE is an Ethereum <span className="text-accent">L2</span> built for real-time trading. Instead of waiting on
          consensus, it pre-executes transactions from the mempool with a <span className="text-accent">parallel EVM (pEVM)</span> and
          streams the results as <span className="text-accent">shreds</span> — sub-blocks delivered every ~2ms that give you an
          instant preconfirmation. Those shreds roll up into a full <span className="text-accent">block</span> roughly once a second
          (the part that carries a state root and settles to Ethereum). So: <b>shreds = instant UX, blocks = finality.</b>
        </p>
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(6, 1fr)", marginTop: 14 }}>
          {FACTS.map(([l, v, h]) => (
            <div key={l} title={h} className="glass glow-edge stat-card" style={{ padding: "11px 13px" }}>
              <div style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: "var(--accent-ink)" }}>{v}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.35 }}>{h}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* educational animated flow */}
      <RiseFlow />

      {/* live chain stats */}
      <SectionLabel>Live chain stats</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
        <Stat big label="Avg block time" value={s ? `${(s.blockTimeMs / 1000).toFixed(1)}s` : "—"} />
        <Stat big label="TPS (24h avg)" value={s ? compact(Math.round(tps)) : "—"} tone="accent" />
        <Stat big label="Txns today" value={s ? compact(s.txToday) : "—"} />
        <Stat big label="Total txns" value={s ? compact(s.totalTxns) : "—"} />
        <Stat big label="Block height" value={s ? compact(s.totalBlocks) : "—"} />
        <Stat big label="Accounts" value={s ? compact(s.addresses) : "—"} />
        <Stat big label="Gas (avg)" value={s ? `${s.gasAvgGwei} gwei` : "—"} />
        <Stat big label="Network load" value={s ? `${s.utilizationPct.toFixed(0)}%` : "—"} />
      </div>
    </div>
  );
}
