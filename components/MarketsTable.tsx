"use client";

import { useState } from "react";
import Link from "next/link";
import type { MarketRow } from "@/lib/analytics";
import { usd, price } from "@/lib/format";
import { Panel } from "@/components/ui";

import { SECTORS, CAT_COLOR, categoryOf } from "@/lib/sectors";
const TABS = ["All", ...Object.keys(SECTORS)];

interface Col {
  key: string;
  label: string;
  align?: "right";
  val: (r: MarketRow) => number | string;
  render: (r: MarketRow) => React.ReactNode;
  color?: (r: MarketRow) => string;
}
const COLS: Col[] = [
  { key: "symbol", label: "Market", val: (r) => r.symbol, render: (r) => <Link href={`/markets/${r.marketId}`} className="mono-link" style={{ fontWeight: 600 }}>{r.symbol}</Link> },
  { key: "category", label: "Sector", val: (r) => categoryOf(r.symbol), render: (r) => { const c = categoryOf(r.symbol); const col = CAT_COLOR[c]; return !col ? <span style={{ color: "var(--muted-2)" }}>{c}</span> : <span className="chip" style={{ fontSize: 10, padding: "2px 8px", color: col, borderColor: `color-mix(in oklab, ${col} 34%, transparent)`, background: `color-mix(in oklab, ${col} 12%, transparent)` }}>{c}</span>; } },
  { key: "mark", label: "Mark Price", align: "right", val: (r) => r.mark, render: (r) => `$${price(r.mark)}` },
  { key: "changePct", label: "24h Change", align: "right", val: (r) => r.changePct, render: (r) => `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`, color: (r) => (r.changePct >= 0 ? "var(--long)" : "var(--short)") },
  { key: "funding8h", label: "Funding 8h", align: "right", val: (r) => r.funding8h, render: (r) => `${(r.funding8h * 100).toFixed(4)}%`, color: (r) => (r.funding8h >= 0 ? "var(--long)" : "var(--short)") },
  { key: "fundingApr", label: "APR", align: "right", val: (r) => r.fundingApr, render: (r) => `${r.fundingApr >= 0 ? "+" : ""}${r.fundingApr.toFixed(1)}%`, color: (r) => (r.fundingApr >= 0 ? "var(--long)" : "var(--short)") },
  { key: "oiUsd", label: "Open Interest", align: "right", val: (r) => r.oiUsd, render: (r) => usd(r.oiUsd) },
  { key: "volume24h", label: "24h Volume", align: "right", val: (r) => r.volume24h, render: (r) => usd(r.volume24h) },
  { key: "maxLev", label: "Max Lev", align: "right", val: (r) => r.maxLev, render: (r) => `${r.maxLev}×`, color: () => "var(--muted)" },
];

export default function MarketsTable({ rows }: { rows: MarketRow[] }) {
  const [sector, setSector] = useState("All");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("oiUsd");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  let view = rows;
  if (sector !== "All") view = view.filter((r) => SECTORS[sector].includes(r.symbol));
  if (q.trim()) view = view.filter((r) => r.symbol.toLowerCase().includes(q.trim().toLowerCase()));
  const col = COLS.find((c) => c.key === sortKey)!;
  view = [...view].sort((a, b) => {
    const av = col.val(a), bv = col.val(b);
    const cmp = typeof av === "string" ? String(av).localeCompare(String(bv)) : (av as number) - (bv as number);
    return dir === "asc" ? cmp : -cmp;
  });

  const sortBy = (k: string) => {
    if (sortKey === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setDir(k === "symbol" ? "asc" : "desc"); }
  };

  return (
    <div data-component="markets-table">
      {/* sector tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {TABS.map((t) => {
          const n = t === "All" ? rows.length : rows.filter((r) => SECTORS[t].includes(r.symbol)).length;
          return (
            <button key={t} onClick={() => setSector(t)} className="pill" data-active={sector === t}>
              {t}{t !== "All" ? ` · ${n}` : ""}
            </button>
          );
        })}
      </div>

      {/* search */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search markets…"
        className="field"
        style={{ marginBottom: 12, padding: "10px 14px", fontSize: 13, border: "1px solid var(--accent-line)" }}
        spellCheck={false}
      />

      {/* sortable table */}
      <Panel style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 860 }}>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => sortBy(c.key)}
                  style={{ cursor: "pointer", userSelect: "none", fontWeight: 400, padding: "11px 12px", textAlign: c.align || "left", whiteSpace: "nowrap", color: sortKey === c.key ? "var(--accent-ink)" : "var(--muted)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid var(--hair)" }}
                >
                  {c.label}
                  <span style={{ opacity: sortKey === c.key ? 1 : 0.25 }}>{sortKey === c.key ? (dir === "asc" ? " ▲" : " ▼") : " ▼"}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.marketId} className="row-hover-link" style={{ borderBottom: "1px solid var(--hair-soft)" }}>
                {COLS.map((c) => (
                  <td key={c.key} style={{ padding: "9px 12px", textAlign: c.align || "left", whiteSpace: "nowrap", color: c.color ? c.color(r) : "var(--ink)", fontVariantNumeric: c.key === "symbol" ? "normal" : "tabular-nums" }}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {view.length === 0 && (
              <tr><td colSpan={COLS.length} style={{ padding: "28px", textAlign: "center", color: "var(--muted)" }}>No markets in this sector{q ? " / search" : ""}.</td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
