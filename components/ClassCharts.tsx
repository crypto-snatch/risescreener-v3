"use client";

import { useState } from "react";
import SeriesChart from "@/components/SeriesChart";
import OiDonut from "@/components/OiDonut";
import { Panel } from "@/components/ui";

// Cum Vol + OI cards share one All/RWA toggle: flipping it filters BOTH charts
// to the RWA (gold + silver) markets. Crypto stays implicit in the "All" view.
type Slice = { name: string; value: number; color: string; rwa: boolean };
type Pt = { t: number } & Record<string, number>;

const GOLD = "#e6c069";

function Seg({ rwa, onChange }: { rwa: boolean; onChange: (v: boolean) => void }) {
  const opts: [string, boolean][] = [["All", false], ["RWA", true]];
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--hair)", borderRadius: 7, overflow: "hidden" }}>
      {opts.map(([label, val]) => {
        const on = rwa === val;
        return (
          <button
            key={label}
            onClick={() => onChange(val)}
            style={{
              padding: "3px 11px", fontSize: 11, cursor: "pointer", border: "none", font: "inherit",
              background: on ? (val ? "color-mix(in oklab, " + GOLD + " 22%, transparent)" : "rgba(255,255,255,0.09)") : "transparent",
              color: on ? (val ? GOLD : "var(--ink)") : "var(--muted)",
              fontWeight: on ? 700 : 400,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// RWA markets were listed recently, so the RWA series is a short tail on a long
// history. In RWA mode, crop the x-axis to the window where RWA actually trades
// (from its first active day, with a minimum width) instead of one lonely bar
// pinned to the right of the full timeline.
const MIN_WIN = 10;

export default function ClassCharts({ volPoints, volGroups, oiSlices }: { volPoints: Pt[]; volGroups: string[]; oiSlices: Slice[] }) {
  const [rwa, setRwa] = useState(false);
  const groups = rwa ? ["XAU", "XAG"] : volGroups; // RWA view splits into gold + silver
  const oiData = (rwa ? oiSlices.filter((s) => s.rwa) : oiSlices).map(({ name, value, color }) => ({ name, value, color }));

  let volPts = volPoints;
  if (rwa) {
    const first = volPoints.findIndex((p) => (p.RWA || 0) > 0);
    const floor = Math.max(0, volPoints.length - MIN_WIN);
    const start = first < 0 ? floor : Math.min(first, floor);
    volPts = volPoints.slice(start);
  }

  return (
    <>
      <SeriesChart title={rwa ? "Cum Vol · RWA" : "Cum Vol"} points={volPts} mode="bars" extraKey="cum" extraLabel="Cumulative" groups={groups} toolbar={<Seg rwa={rwa} onChange={setRwa} />} />
      <Panel pad="14px 16px">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{rwa ? "OI · RWA" : "OI"}</div>
          <Seg rwa={rwa} onChange={setRwa} />
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
