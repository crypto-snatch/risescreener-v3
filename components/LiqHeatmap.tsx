import { usd } from "@/lib/format";

type Tile = { name: string; size: number; color: string };

// Equal, aligned tiles keep small markets readable and avoid the misleading
// empty/overlapping geometry of a treemap. Value, share and the bar all encode
// the same comparison explicitly.
export default function LiqHeatmap({ data, height = 320 }: { data: Tile[]; height?: number | string }) {
  const ordered = [...data].filter((item) => item.size > 0).sort((a, b) => b.size - a.size);
  const total = ordered.reduce((sum, item) => sum + item.size, 0) || 1;
  const max = ordered[0]?.size || 1;
  return (
    <div
      style={{
        width: "100%",
        height,
        display: "grid",
        // Keep the five ranked groups on one horizontal lane. On narrow
        // screens the lane scrolls sideways instead of creating a clipped
        // second row below ChartCard's deliberately short plot.
        gridTemplateColumns: `repeat(${ordered.length}, minmax(96px, 1fr))`,
        gridTemplateRows: "minmax(0, 1fr)",
        gap: 7,
        overflowX: "auto",
        overflowY: "hidden",
        overscrollBehaviorX: "contain",
      }}
    >
      {ordered.map((item, index) => {
        const share = (item.size / total) * 100;
        const relative = (item.size / max) * 100;
        return (
          <div
            key={item.name}
            title={`${item.name}: ${usd(item.size)} · ${share.toFixed(1)}%`}
            style={{
              minWidth: 0,
              padding: "10px 11px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 7,
              overflow: "hidden",
              border: `1px solid color-mix(in oklab, ${item.color} 55%, var(--hair))`,
              borderRadius: 7,
              background: `color-mix(in oklab, ${item.color} 13%, var(--bg-2))`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <strong style={{ color: "var(--ink)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</strong>
              <span className="tnum" style={{ color: "var(--muted)", fontSize: 10.5 }}>#{index + 1}</span>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span className="tnum" style={{ color: item.color, fontSize: 15, fontWeight: 750 }}>{usd(item.size)}</span>
                <span className="tnum" style={{ color: "var(--muted)", fontSize: 10.5 }}>{share.toFixed(1)}%</span>
              </div>
              <div style={{ height: 4, marginTop: 7, overflow: "hidden", borderRadius: 3, background: "var(--hair)" }}>
                <span style={{ display: "block", width: `${relative}%`, height: "100%", borderRadius: 3, background: item.color }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
