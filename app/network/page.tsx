import { getChainStats, getLatestBlocks } from "@/lib/chain";
import { compact } from "@/lib/format";
import { Panel, Stat } from "@/components/ui";
import RiseFlow from "@/components/RiseFlow";
import PageHeader from "@/components/PageHeader";
import NetworkActivity from "@/components/NetworkActivity";

export const revalidate = 15;
export const metadata = { title: "Network — RiseScreener" };

const FACTS: [string, string, string][] = [
  ["Type", "Ethereum L2", "OP Stack · settles to Ethereum"],
  ["Execution", "pEVM", "parallel EVM across CPU cores"],
  ["Block time", "~1s", "full block + state root"],
  ["Latency", "~1ms", "published execution latency · shreds"],
  ["Capacity", "5 Ggas/s", "published capacity · 50k peak TPS"],
  ["Settlement", "Ethereum", "L1 settlement · EigenDA data availability"],
];

export default async function NetworkPage() {
  const [s,blocks] = await Promise.all([getChainStats().catch(() => null),getLatestBlocks(25).catch(()=>[])]);
  const tps = s ? s.txToday / 86400 : 0;

  return (
    <div className="screen" data-page="network" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader eyebrow="Protocol / RISE mainnet" title="Network" description="Observed throughput, sealed blocks and the infrastructure behind RISE." />
      <div className="network-metrics">
        <Stat big label="TPS · 24h average" value={s ? compact(Math.round(tps)) : "—"} tone="accent" />
        <Stat big label="Avg block time" value={s ? `${(s.blockTimeMs / 1000).toFixed(1)}s` : "—"} />
        <Stat big label="Network utilization" value={s ? `${s.utilizationPct.toFixed(0)}%` : "—"} />
        <Stat big label="Block height" value={s ? compact(s.totalBlocks) : "—"} />
        <Stat big label="24h transactions" value={s ? compact(s.txToday) : "—"} />
        <Stat big label="Total transactions" value={s ? compact(s.totalTxns) : "—"} />
        <Stat big label="Chain accounts" value={s ? compact(s.addresses) : "—"} />
        <Stat big label="Average gas price" value={s ? `${s.gasAvgGwei} gwei` : "—"} />
      </div>
      <NetworkActivity blocks={blocks} />

      {/* intro / what is RISE */}
      <Panel className="glass-2" pad="18px 20px" style={{ borderRadius: "var(--r-lg)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>RISE — the trading chain</div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6, maxWidth: 820 }}>
          RISE is an Ethereum <span className="text-accent">L2</span> built for real-time markets.
          Its Continuous Block Pipeline and <span className="text-accent">parallel EVM (pEVM)</span> process transactions
          while <span className="text-accent">shreds</span> stream early execution results to applications.
          Full L2 blocks arrive roughly once a second; Ethereum settlement happens separately.
          RISEx brings crypto, equity and commodity perpetuals together with portfolio margin and AutoYield.
          Published capacity figures below describe the network design; measured activity appears in the live counters.
        </p>
        <p className="network-sources">Verified 28 Oct 2026 · <a href="https://www.risechain.com/" target="_blank" rel="noreferrer">RISE overview ↗</a> · <a href="https://docs.risechain.com/docs/risex/core/overview" target="_blank" rel="noreferrer">Technical docs ↗</a></p>
        <div className="network-facts">
          {FACTS.map(([l, v, h]) => (
            <div key={l} title={h} className="glass glow-edge stat-card" style={{ padding: "11px 13px" }}>
              <div style={{ fontSize: 10.5, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--muted)" }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: "var(--accent-ink)" }}>{v}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.35 }}>{h}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* educational animated flow */}
      <RiseFlow />

    </div>
  );
}
