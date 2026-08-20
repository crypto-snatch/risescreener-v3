"use client";

import { useState } from "react";
import SeriesChart from "@/components/SeriesChart";
import ChartCard from "@/components/ChartCard";
import { Donut } from "@/components/charts";
import { CMD_SYMBOLS, STOCK_SYMBOLS, CLASS_COLOR, type AssetClass } from "@/lib/sectors";

// Cum Vol + OI cards share an All/Commodities/Stocks switch. Each RWA class is
// split into every currently hosted market instead of the old XAU/XAG-only view.
type Slice = { name: string; value: number; color: string; cls: AssetClass };
type Pt = { t: number; est?: boolean } & Record<string, number | boolean | undefined>;

type Mode = "All" | "Commodities" | "Stocks";
const MODE_ACCENT: Record<Mode, string | undefined> = { All: undefined, Commodities: CLASS_COLOR.Commodities, Stocks: CLASS_COLOR.Stocks };

function Seg({ mode, onChange }: { mode: Mode; onChange: (v: Mode) => void }) {
  const opts: Mode[] = ["All", "Commodities", "Stocks"];
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--hair)", borderRadius: 7, overflow: "hidden" }}>
      {opts.map((value) => {
        const on = mode === value;
        const accent = MODE_ACCENT[value];
        return (
          <button
            type="button"
            key={value}
            onClick={() => onChange(value)}
            style={{
              minHeight: 32, padding: "4px 10px", fontSize: 11, cursor: "pointer", border: "none", font: "inherit",
              background: on ? (accent ? `color-mix(in oklab, ${accent} 22%, transparent)` : "rgba(255,255,255,0.09)") : "transparent",
              color: on ? (accent ?? "var(--ink)") : "var(--muted)",
              fontWeight: on ? 700 : 400,
            }}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

// RWA markets were listed recently, so each class is a short tail on a long
// history. Crop a class view to its actual trading window instead of leaving a
// few bars pinned to the far right of the complete exchange timeline.
const MIN_WIN = 10;

export default function ClassCharts({ volPoints, volGroups, oiSlices }: { volPoints: Pt[]; volGroups: string[]; oiSlices: Slice[] }) {
  const [mode, setMode] = useState<Mode>("All");
  const groups = mode === "Commodities" ? CMD_SYMBOLS : mode === "Stocks" ? STOCK_SYMBOLS : volGroups;
  const oiData = oiSlices
    .filter((slice) => mode === "All" || slice.cls === mode)
    .map(({ name, value, color }) => ({ name, value, color }));

  let volPts = volPoints;
  if (mode !== "All") {
    const first = volPoints.findIndex((p) => (Number(p[mode]) || 0) > 0);
    const floor = Math.max(0, volPoints.length - MIN_WIN);
    const start = first < 0 ? floor : Math.min(first, floor);
    volPts = volPoints.slice(start);
  }
  const suffix = mode === "All" ? "" : ` · ${mode}`;
  const oiTotal = oiData.reduce((total, item) => total + item.value, 0) || 1;
  const oiLegend = oiData.map((item) => ({ ...item, value: `$${item.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, pct: (item.value / oiTotal) * 100 }));

  return (
    <>
      <SeriesChart title={`Cum Vol${suffix}`} points={volPts} mode="bars" extraKey="cum" extraLabel="Cumulative" groups={groups} toolbar={<Seg mode={mode} onChange={setMode} />} />
      <ChartCard title={`OI${suffix}`} subtitle="Live RISEx open interest by market" height={340} modalHeight={500} legend={oiLegend} toolbar={<Seg mode={mode} onChange={setMode} />} filename={`risescreener-oi-${mode.toLowerCase()}`}>
        {oiData.length > 0 ? (
          <Donut data={oiData} height="100%" labels={oiData.length <= 8} />
        ) : (
          <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>no data</div>
        )}
      </ChartCard>
    </>
  );
}
