import { EXPLORER_API, CONTRACTS } from "./constants";

// CollateralManager deposit/withdraw events → protocol flows.
// DepositedCollateral(address,address,address,uint256) / WithdrawnCollateral(...)
const DEP = "0x1a52dc5f";
const WIT = "0xba06d99e";
const USDC_DECIMALS = 6;
const KNOWN = new Set([
  "0xe436820ba0c69702c1d3e601d421c0ef38262739", // USDC token
  CONTRACTS.CollateralManager.toLowerCase(),
  CONTRACTS.PerpsManager.toLowerCase(),
  "0xaadde0cea454f2bcb26f46ed54c5709b7bb34a7e", // router
]);

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
}

function accountFromTopics(topics: string[]): string {
  for (const t of topics.slice(1)) {
    if (/^0x0{24}[0-9a-f]{40}$/i.test(t)) {
      const a = "0x" + t.slice(26).toLowerCase();
      if (!KNOWN.has(a)) return a;
    }
  }
  return "";
}

export async function getFlows(maxPages = 4): Promise<FlowsResult> {
  const recent: Flow[] = [];
  let url: string | null = `${EXPLORER_API}/addresses/${CONTRACTS.CollateralManager}/logs`;
  let pages = 0;
  try {
    while (url && pages < maxPages) {
      const r: { items?: RawLog[]; next_page_params?: Record<string, unknown> } = await fetch(url, { next: { revalidate: 30 } }).then((x) => x.json());
      for (const it of r.items ?? []) {
        const t0 = (it.topics?.[0] || "").slice(0, 10);
        const isDep = t0 === DEP;
        const isWit = t0 === WIT;
        if (!isDep && !isWit) continue;
        const amount = it.data && it.data !== "0x" ? Number(BigInt(it.data.slice(0, 66))) / 10 ** USDC_DECIMALS : 0;
        recent.push({
          type: isDep ? "deposit" : "withdraw",
          account: accountFromTopics(it.topics ?? []),
          amount,
          txHash: it.transaction_hash ?? it.tx_hash ?? "",
          blockNumber: it.block_number ?? 0,
          timeMs: it.block_timestamp ? new Date(it.block_timestamp).getTime() : 0,
        });
      }
      pages++;
      const p = r.next_page_params;
      if (!p) break;
      const qs = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
      url = `${EXPLORER_API}/addresses/${CONTRACTS.CollateralManager}/logs?${qs}`;
    }
  } catch {
    /* explorer hiccup */
  }

  const cutoff = Date.now() - 24 * 3600 * 1000;
  const in24 = recent.filter((f) => f.timeMs >= cutoff);
  const deposit24h = in24.filter((f) => f.type === "deposit").reduce((s, f) => s + f.amount, 0);
  const withdraw24h = in24.filter((f) => f.type === "withdraw").reduce((s, f) => s + f.amount, 0);
  return { recent: recent.slice(0, 60), deposit24h, withdraw24h, net24h: deposit24h - withdraw24h };
}

interface RawLog {
  topics: string[];
  data: string;
  transaction_hash?: string;
  tx_hash?: string;
  block_number?: number;
  block_timestamp?: string;
}
