"use client";

import { useState } from "react";
import SeriesChart from "@/components/SeriesChart";
import OiDonut from "@/components/OiDonut";
import { Panel } from "@/components/ui";
import { CMD_SYMBOLS, STOCK_SYMBOLS, CLASS_COLOR, type AssetClass } from "@/lib/sectors";

// Cum Vol + OI cards share one All/Commodities/Stocks toggle: flipping it
// filters BOTH charts to that asset class. Crypto stays implicit in "All".
type Slice = { name: string; value: number; color: string; cls: AssetClass };
type Pt = { t: number; est?: boolean } & Record<string, number | boolean | undefined>;

type Mode = "All" | "Commodities" | "Stocks";
const MODE_ACCENT: Record<Mode, string | undefined> = { All: undefined, Commodities: CLASS_COLOR.Commodities, Stocks: CLASS_COLOR.Stocks };

function Seg({ mode, onChange }: { mode: Mode; onChange: (v: Mode) => void }) {
  const opts: Mode[] = ["All", "Commodities", "Stocks"];
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--hair)", borderRadius: 7, overflow: "hidden" }}>
      {opts.map((m) => {
        const on = mode === m;
        const accent = MODE_ACCENT[m];
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              padding: "3px 10px", fontSize: 11, cursor: "pointer", border: "none", font: "inherit",
              background: on ? (accent ? `color-mix(in oklab, ${accent} 22%, transparent)` : "rgba(255,255,255,0.09)") : "transparent",
              color: on ? (accent ?? "var(--ink)") : "var(--muted)",
              fontWeight: on ? 700 : 400,
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

// RWA markets were listed recently, so their series are short tails on a long
// history. In a class view, crop the x-axis to the window where that class
// actually trades (from its first active day, with a minimum width) instead of
// a few lonely bars pinned to the right of the full timeline.
const MIN_WIN = 10;

export default function ClassCharts({ volPoints, volGroups, oiSlices }: { volPoints: Pt[]; volGroups: string[]; oiSlices: Slice[] }) {
  const [mode, setMode] = useState<Mode>("All");
  const groups = mode === "Commodities" ? CMD_SYMBOLS : mode === "Stocks" ? STOCK_SYMBOLS : volGroups; // class views split into per-market bands
  const oiData = oiSlices
    .filter((s) => (mode === "All" ? true : s.cls === mode))
    .map(({ name, value, color }) => ({ name, value, color }));

  let volPts = volPoints;
  if (mode !== "All") {
    const first = volPoints.findIndex((p) => (Number(p[mode]) || 0) > 0); // aggregate field carries the class name
    const floor = Math.max(0, volPoints.length - MIN_WIN);
    const start = first < 0 ? floor : Math.min(first, floor);
    volPts = volPoints.slice(start);
  }

  const suffix = mode === "All" ? "" : ` · ${mode}`;
  return (
    <>
      <SeriesChart title={`Cum Vol${suffix}`} points={volPts} mode="bars" extraKey="cum" extraLabel="Cumulative" groups={groups} toolbar={<Seg mode={mode} onChange={setMode} />} />
      <Panel pad="14px 16px">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{`OI${suffix}`}</div>
          <Seg mode={mode} onChange={setMode} />
        </div>
        {oiData.length > 0 ? (
          <OiDonut data={oiData} height={340} />
        ) : (
          <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>no data</div>
        )}
      </Panel>
    </>
  );
}
