"use client";

import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Sector } from "recharts";
import { usd } from "@/lib/format";

type D = { name: string; value: number; color: string };

export default function OiDonut({ data, height = 340 }: { data: D[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const [active, setActive] = useState<number | null>(null);
  const pct = (v: number) => (v / total) * 100;
  const cur = active != null ? data[active] : null;

  // hovered slice pops outward
  const activeShape = (p: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = p;
    return (
      <g>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 9} startAngle={startAngle} endAngle={endAngle} fill={fill} />
        <Sector cx={cx} cy={cy} innerRadius={outerRadius + 11} outerRadius={outerRadius + 13} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.45} />
      </g>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 152px", gap: 10, alignItems: "center" }}>
      <div style={{ position: "relative" }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="60%"
              outerRadius="90%"
              paddingAngle={1.5}
              activeIndex={active == null ? undefined : active}
              activeShape={activeShape}
              onMouseEnter={(_: unknown, i: number) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} stroke="transparent" fillOpacity={active == null || active === i ? 1 : 0.18} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* center readout */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 2 }}>
          <div style={{ fontSize: 10, color: "var(--muted-2)", letterSpacing: ".12em", textTransform: "uppercase" }}>{cur ? cur.name : "Total OI"}</div>
          <div className="tnum" style={{ fontSize: 21, fontWeight: 800, color: cur ? cur.color : "var(--ink)", transition: "color .2s" }}>{usd(cur ? cur.value : total)}</div>
          {cur && <div className="tnum" style={{ fontSize: 12.5, color: "var(--muted)" }}>{pct(cur.value).toFixed(1)}%</div>}
        </div>
      </div>

      {/* interactive legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {data.map((d, i) => (
          <button
            key={d.name}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            style={{
              display: "flex", alignItems: "center", gap: 7, fontSize: 11, padding: "3px 5px", borderRadius: 5,
              border: "none", outline: "none", font: "inherit",
              background: active === i ? "rgba(255,255,255,0.07)" : "transparent",
              opacity: active == null || active === i ? 1 : 0.45,
              transition: "opacity .15s ease, background .15s ease",
              cursor: "default", textAlign: "left", width: "100%", whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 400, color: "var(--ink)" }}>{d.name}</span>
            <span className="tnum" style={{ marginLeft: "auto", color: active === i ? "var(--ink)" : "var(--muted)" }}>{pct(d.value).toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
