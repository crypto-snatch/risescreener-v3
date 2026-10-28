import { EXPLORER_API, CONTRACTS } from "./constants";

// CollateralManager deposit/withdraw events → protocol flows.
// DepositedCollateral(address,address,address,uint256) / WithdrawnCollateral(...)
const DEP = "0x1a52dc5f";
const WIT = "0xba06d99e";
const USDC_DECIMALS = 6;

export interface Flow {
  type: "deposit" | "withdraw";
  account: string;
  amount: number; // USDC
  txHash: string;
  blockNumber: number;
  timeMs: number;
}
export interface FlowsResult {
  recent: Flow[];
  deposit24h: number;
  withdraw24h: number;
  net24h: number;
  complete24h: boolean;
  scannedSince: number | null;
}

export async function getFlows(maxPages = 12): Promise<FlowsResult> {
  const recent: Flow[] = [];
  let url: string | null = `${EXPLORER_API}/addresses/${CONTRACTS.CollateralManager}/logs`;
  let pages = 0;
  let scannedSince: number | null = null;
  let complete24h = false;
  const cutoff = Date.now() - 24 * 3600 * 1000;
  try {
    while (url && pages < maxPages) {
      const response = await fetch(url, { next: { revalidate: 30 }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`Explorer returned ${response.status}`);
      const r: { items?: RawLog[]; next_page_params?: Record<string, unknown> } = await response.json();
      if (!Array.isArray(r.items)) throw new Error("Explorer returned no log list");
      for (const it of r.items) {
        const timestamp = it.block_timestamp ? Date.parse(it.block_timestamp) : 0;
        if (timestamp>0) scannedSince = Math.min(scannedSince ?? timestamp,timestamp);
        const t0 = (it.topics?.[0] || "").slice(0, 10);
        const isDep = t0 === DEP;
        const isWit = t0 === WIT;
        if (!isDep && !isWit) continue;
        // The amount is token-native. This view measures USDC.e collateral only.
        if (it.topics?.[3]?.slice(-40).toLowerCase() !== "e436820ba0c69702c1d3e601d421c0ef38262739") continue;
        const amount = it.data && it.data !== "0x" ? Number(BigInt(it.data.slice(0, 66))) / 10 ** USDC_DECIMALS : 0;
        recent.push({
          type: isDep ? "deposit" : "withdraw",
          account: "0x" + (it.topics?.[isDep ? 2 : 1] ?? "").slice(-40),
          amount,
          txHash: it.transaction_hash ?? it.tx_hash ?? "",
          blockNumber: it.block_number ?? 0,
          timeMs: it.block_timestamp ? new Date(it.block_timestamp).getTime() : 0,
        });
      }
      pages++;
      const p = r.next_page_params;
      if (!p || (scannedSince!=null && scannedSince<=cutoff)) {complete24h=true;break;}
      const qs = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
      url = `${EXPLORER_API}/addresses/${CONTRACTS.CollateralManager}/logs?${qs}`;
    }
  } catch {
    /* explorer hiccup */
  }

  const in24 = recent.filter((f) => f.timeMs >= cutoff);
  const deposit24h = in24.filter((f) => f.type === "deposit").reduce((s, f) => s + f.amount, 0);
  const withdraw24h = in24.filter((f) => f.type === "withdraw").reduce((s, f) => s + f.amount, 0);
  return { recent: recent.slice(0, 60), deposit24h, withdraw24h, net24h: deposit24h - withdraw24h,complete24h,scannedSince };
}

interface RawLog {
  topics: string[];
  data: string;
  transaction_hash?: string;
  tx_hash?: string;
  block_number?: number;
  block_timestamp?: string;
}
