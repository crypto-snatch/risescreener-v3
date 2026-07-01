import Link from "next/link";
import { notFound } from "next/navigation";
import { getTx } from "@/lib/chain";
import { EXPLORER_UI } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { contractLabel, methodLabel } from "@/lib/labels";
import { Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "12px 18px" }}>
      <span className="text-muted" style={{ width: 116, flexShrink: 0, fontSize: 12 }}>{label}</span>
      <span style={{ flex: 1, wordBreak: "break-all", fontSize: 12.5, fontVariantNumeric: mono ? "tabular-nums" : "normal" }}>{children}</span>
    </div>
  );
}

export default async function TxPage({ params }: { params: { hash: string } }) {
  const hash = params.hash;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) notFound();
  const tx = await getTx(hash);

  return (
    <div className="screen" data-page="tx" style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Transaction</h1>
        <Link href="/" className="text-muted" style={{ fontSize: 12 }}>← home</Link>
      </div>

      {!tx ? (
        <Panel style={{ padding: "32px 16px", textAlign: "center" }}>
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Transaction not found (it may still be indexing).</p>
          <a className="mono-link" href={`${EXPLORER_UI}/tx/${hash}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10 }}>Open on explorer ↗</a>
        </Panel>
      ) : (
        <Panel className="divide">
          <Row label="Hash" mono>{tx.hash}</Row>
          <Row label="Status">
            <span className="chip" style={{ color: tx.status === "ok" ? "var(--long)" : "var(--short)", borderColor: tx.status === "ok" ? "color-mix(in oklab, var(--long) 30%, transparent)" : "color-mix(in oklab, var(--short) 30%, transparent)" }}>
              {tx.status === "ok" ? "● success" : tx.status ? "✕ failed" : "—"}
            </span>
          </Row>
          <Row label="Method"><span className="chip">{methodLabel(tx.method)}</span></Row>
          <Row label="Block" mono>{tx.blockNumber?.toLocaleString() ?? "—"}</Row>
          <Row label="Age">{tx.timestampMs ? timeAgo(tx.timestampMs) : "—"}</Row>
          <Row label="From" mono><Link className="mono-link" href={`/address/${tx.from}`}>{tx.from}</Link></Row>
          <Row label="To" mono>
            {tx.to ? <><Link className="mono-link" href={`/address/${tx.to}`}>{tx.to}</Link> <span className="text-muted">({contractLabel(tx.to)})</span></> : "—"}
          </Row>
          <Row label="Value" mono>{tx.value}</Row>
          <Row label="Gas used" mono>{tx.gasUsed ?? "—"}</Row>
          <Row label="Fee" mono>{tx.fee ?? "—"}</Row>
          <Row label="Explorer"><a className="mono-link" href={`${EXPLORER_UI}/tx/${hash}`} target="_blank" rel="noreferrer">view ↗</a></Row>
        </Panel>
      )}
    </div>
  );
}
