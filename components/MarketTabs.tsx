"use client";

import { useState } from "react";
import { price } from "@/lib/format";

export interface MItem {
  symbol: string;
  mark: number;
  maxLev: number;
  changePct: number;
}

export default function MarketTabs({ data }: { data: { listed: MItem[]; upcoming: MItem[] } }) {
  const [tab, setTab] = useState<"listed" | "upcoming">("listed");
  const items = data[tab];
  return (
    <div data-component="market-tabs">
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {([["listed", "Listed", data.listed.length], ["upcoming", "Upcoming", data.upcoming.length]] as const).map(([k, l, n]) => (
          <button key={k} onClick={() => setTab(k)} className="pill" data-active={tab === k}>
            {l} · {n}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        {items.map((m) => (
          <div key={m.symbol} className="glass glow-edge" style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{m.symbol}</span>
              <span className="text-muted" style={{ fontSize: 10.5 }}>{m.maxLev}×</span>
            </div>
            {tab === "listed" ? (
              <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span className="text-accent tnum" style={{ fontSize: 14 }}>${price(m.mark)}</span>
                <span className="tnum" style={{ fontSize: 11, color: m.changePct >= 0 ? "var(--long)" : "var(--short)" }}>
                  {m.changePct >= 0 ? "▲ " : "▼ "}{m.changePct >= 0 ? "+" : ""}{m.changePct.toFixed(2)}%
                </span>
              </div>
            ) : (
              <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>price feed pending</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
