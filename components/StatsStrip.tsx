"use client";

import { useEffect, useState } from "react";
import { compact, usd } from "@/lib/format";
import { Stat } from "@/components/ui";

interface ChainStats {
  totalBlocks: number;
  totalTxns: number;
  addresses: number;
  blockTimeMs: number;
  utilizationPct: number;
  gasAvgGwei: number;
  tps: number;
  tvl: number | null;
}

const RISEX_TAKER_FEE = "0.03%"; // 3 bps

export default function StatsStrip({ marketsCount }: { marketsCount: number }) {
  const [s, setS] = useState<ChainStats | null>(null);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const d = await fetch("/api/chain/stats", { cache: "no-store" }).then((r) => r.json());
        if (alive && !d.error) setS(d);
      } catch {}
    }
    pull();
    const t = setInterval(pull, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const items: [string, string, string?, ("accent" | undefined)?][] = [
    ["TPS", s ? compact(s.tps) : "—", "txns / sec", "accent"],
    ["Block time", s ? `${(s.blockTimeMs / 1000).toFixed(1)}s` : "—"],
    ["Gas", s ? `${s.gasAvgGwei} gwei` : "—"],
    ["Block height", s ? compact(s.totalBlocks) : "—"],
    ["Total txns", s ? compact(s.totalTxns) : "—"],
    ["Accounts", s ? compact(s.addresses) : "—"],
    ["Network load", s ? `${s.utilizationPct.toFixed(0)}%` : "—"],
    ["TVL", s?.tvl ? usd(s.tvl) : "—"],
    ["Taker fee", RISEX_TAKER_FEE],
    ["Markets", String(marketsCount)],
  ];

  return (
    <div data-component="stats-strip" className="stats-grid">
      {items.map(([l, v, h, tone]) => (
        <Stat key={l} label={l} value={v} hint={h} tone={tone} />
      ))}
    </div>
  );
}
