"use client";

import { ResponsiveContainer, Treemap } from "recharts";
import { usd } from "@/lib/format";

type Tile = { name: string; size: number; color: string };

// Treemap heat map of liquidations by market — tile area ∝ liquidated value,
// colored per market (not a single red tone).
export default function LiqHeatmap({ data, height = 320 }: { data: Tile[]; height?: number | string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={data}
        dataKey="size"
        stroke="var(--bg)"
        isAnimationActive
        animationDuration={520}
        content={<Cell />}
      />
    </ResponsiveContainer>
  );
}

function Cell(props: any) {
  const { x, y, width, height, name, size, color } = props;
  if (width == null || height == null || width < 1 || height < 1) return null;
  const fill = color ?? "#ff5468";
  const big = width > 66 && height > 40;
  const mid = width > 44 && height > 26;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} style={{ fill, stroke: "var(--bg)", strokeWidth: 2, transition: "fill .2s ease" }} />
      {big ? (
        <>
          <text x={x + 11} y={y + 22} fontSize={14} fontWeight={800} fontFamily="var(--font)" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,0.35)" strokeWidth={2.6} fill="#fff">{name}</text>
          <text x={x + 11} y={y + 40} fontSize={12} fontWeight={600} fontFamily="var(--font)" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,0.3)" strokeWidth={2.4} fill="rgba(255,255,255,0.92)">{usd(size)}</text>
        </>
      ) : mid ? (
        <text x={x + width / 2} y={y + height / 2 + 3} textAnchor="middle" fontSize={10} fontWeight={700} fontFamily="var(--font)" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,0.35)" strokeWidth={2.4} fill="#fff">{name}</text>
      ) : null}
    </g>
  );
}
