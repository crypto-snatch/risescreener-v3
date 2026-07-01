import Link from "next/link";
import { shortAddr } from "@/lib/format";
import { Panel } from "@/components/ui";

export interface TopRow {
  account: string;
  value: string;
  sub?: string;
  tone?: "long" | "short" | "accent";
}

export default function TopWallets({ title, metric, rows }: { title: string; metric: string; rows: TopRow[] }) {
  return (
    <Panel data-component="top-wallets">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--hair)" }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</span>
        <span style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted-2)" }}>{metric}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>no data yet</div>
      ) : (
        <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {rows.map((r, i) => (
            <li key={r.account} className="row row-hover-link" style={{ gridTemplateColumns: "18px 1fr auto", display: "grid" }}>
              <span className="text-muted" style={{ fontSize: 11 }}>{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <Link className="mono-link" href={`/address/${r.account}`} style={{ fontSize: 13 }}>{shortAddr(r.account)}</Link>
                {r.sub && <div className="text-muted" style={{ fontSize: 10.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</div>}
              </div>
              <span className="tnum" style={{ fontSize: 13, color: r.tone === "long" ? "var(--long)" : r.tone === "short" ? "var(--short)" : "var(--accent-ink)" }}>{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
