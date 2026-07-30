"use client";

import { useState } from "react";
import { Stat } from "@/components/ui";
import { CLASS_COLOR } from "@/lib/sectors";
import { usd } from "@/lib/format";

// The RWA stat band on Overview: one group of three tiles (OI / 24h vol /
// cumulative vol) with a Commodities ↔ Stocks toggle in the group header.
// Numbers for both classes are computed server-side and passed in; the toggle
// just flips which set is shown. Mirrors the StatGroup markup in
// app/overview/page.tsx so the band keeps uniform tile sizing.
export type RwaClassStats = { oi: number; oiPct: number; vol24: number; cum: number | null };

const GOLD = CLASS_COLOR.Commodities;
const AZURE = CLASS_COLOR.Stocks;

export default function RwaStats({ cmd, stk }: { cmd: RwaClassStats; stk: RwaClassStats }) {
  const [mode, setMode] = useState<"cmd" | "stk">("cmd");
  const s = mode === "cmd" ? cmd : stk;
  const color = mode === "cmd" ? GOLD : AZURE;
  const count = 3;
  return (
    <div style={{ flex: `${count} 1 ${count * 132}px`, minWidth: count * 118, display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 2px 4px", borderBottom: "1px solid var(--hair)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color, fontWeight: 600 }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
        RWA
        <span style={{ display: "inline-flex", border: "1px solid var(--hair)", borderRadius: 6, overflow: "hidden", marginLeft: "auto" }}>
          {([["Commodities", "cmd", GOLD], ["Stocks", "stk", AZURE]] as const).map(([label, val, accent]) => {
            const on = mode === val;
            return (
              <button
                key={val}
                onClick={() => setMode(val)}
                style={{
                  padding: "2px 9px", fontSize: 9.5, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer", border: "none", font: "inherit",
                  background: on ? `color-mix(in oklab, ${accent} 20%, transparent)` : "transparent",
                  color: on ? accent : "var(--muted)",
                  fontWeight: on ? 700 : 500,
                }}
              >
                {label}
              </button>
            );
          })}
        </span>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${count}, minmax(0,1fr))`, gap: 10 }}>
        <Stat big label="Open interest" value={usd(s.oi)} color={color} hint={`${s.oiPct.toFixed(1)}% of total OI`} />
        <Stat big label="24h volume" value={usd(s.vol24)} color={color} />
        <Stat big label="Cumulative volume" value={s.cum != null ? usd(s.cum) : "—"} color={color} hint={s.cum == null ? "pending data refresh" : undefined} />
      </div>
    </div>
  );
}
