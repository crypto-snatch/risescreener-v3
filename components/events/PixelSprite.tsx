// Renders a sprite (rows of palette keys) as a crisp inline SVG. Horizontal runs
// of one colour become a single rect, so even the 18×18 mascot stays light.
export default function PixelSprite({ rows, palette, size, className, title }: {
  rows: string[];
  palette: Record<string, string>;
  size?: number;
  className?: string;
  title?: string;
}) {
  const width = Math.max(...rows.map((row) => row.length));
  const runs: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const fill = palette[row[x]];
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      if (fill) runs.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return (
    <svg
      className={className}
      width={size}
      height={size ? (size * rows.length) / width : undefined}
      viewBox={`0 0 ${width} ${rows.length}`}
      shapeRendering="crispEdges"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {runs.map((run) => <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={1} fill={run.fill} />)}
    </svg>
  );
}

export const TROPHY = [
  ".YYYYYYYYYY.",
  "Y.YYYYYYYY.Y",
  "Y.YYYYYYYY.Y",
  "Y.YYYYYYYY.Y",
  ".YYYYYYYYYY.",
  "..YYYYYYYY..",
  "...YYYYYY...",
  ".....YY.....",
  ".....YY.....",
  "....YYYY....",
  "...DDDDDD...",
  "..DDDDDDDD..",
];
