import { EXPLORER_API, RISE_RPC } from "./constants";

// ── low-level Blockscout fetch ────────────────────────────────
async function bs<T>(path: string, revalidate = 2): Promise<T> {
  const res = await fetch(`${EXPLORER_API}${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`explorer ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

// ── chain-wide stats (for the stats strip) ────────────────────
export interface ChainStats {
  totalBlocks: number;
  totalTxns: number;
  txToday: number;
  addresses: number;
  blockTimeMs: number;
  utilizationPct: number;
  gasAvgGwei: number;
  tps: number; // derived: txToday / 86400
  tvl: number | null;
}

export async function getChainStats(): Promise<ChainStats> {
  const s = await bs<{
    total_blocks: string;
    total_transactions: string;
    transactions_today: string;
    total_addresses: string;
    average_block_time: number;
    network_utilization_percentage: number;
    gas_prices: { average: number };
    tvl: string | null;
  }>("/stats", 10);
  const txToday = Number(s.transactions_today) || 0;
  return {
    totalBlocks: Number(s.total_blocks) || 0,
    totalTxns: Number(s.total_transactions) || 0,
    txToday,
    addresses: Number(s.total_addresses) || 0,
    blockTimeMs: s.average_block_time || 0,
    utilizationPct: s.network_utilization_percentage || 0,
    gasAvgGwei: s.gas_prices?.average ?? 0,
    tps: txToday / 86400,
    tvl: s.tvl ? Number(s.tvl) : null,
  };
}

// ── latest blocks (the accumulating block stream) ─────────────
export interface BlockRow {
  height: number;
  hash: string;
  txCount: number;
  timestampMs: number;
  gasUsed: number;
  gasLimit: number;
}

export async function getLatestBlocks(limit = 25): Promise<BlockRow[]> {
  const d = await bs<{
    items: {
      height: number;
      hash: string;
      transactions_count: number | null;
      tx_count?: number | null;
      timestamp: string;
      gas_used: string;
      gas_limit: string;
    }[];
  }>("/blocks?type=block", 2);
  return (d.items ?? []).slice(0, limit).map((b) => ({
    height: b.height,
    hash: b.hash,
    txCount: b.transactions_count ?? b.tx_count ?? 0,
    timestampMs: new Date(b.timestamp).getTime(),
    gasUsed: Number(b.gas_used) || 0,
    gasLimit: Number(b.gas_limit) || 0,
  }));
}

// ── latest transactions (the accumulating tx stream) ──────────
export interface TxRow {
  hash: string;
  method: string | null;
  from: string;
  to: string | null;
  timestampMs: number;
  value: string;
  blockNumber: number | null;
}

// Blockscout caps the tx list page at 50 — that is the max we can pull per poll.
export async function getLatestTxns(limit = 50): Promise<TxRow[]> {
  const d = await bs<{
    items: {
      hash: string;
      method: string | null;
      from: { hash: string } | null;
      to: { hash: string } | null;
      timestamp: string;
      value: string;
      block_number?: number | null;
      block?: number | null;
    }[];
  }>("/transactions", 1);
  return (d.items ?? []).slice(0, limit).map((t) => ({
    hash: t.hash,
    method: t.method,
    from: t.from?.hash ?? "",
    to: t.to?.hash ?? null,
    timestampMs: new Date(t.timestamp).getTime(),
    value: t.value ?? "0",
    blockNumber: t.block_number ?? t.block ?? null,
  }));
}

// ── live chain head via JSON-RPC (fresh tip, no indexer lag) ──
// Blockscout's list endpoints lag the tip by ~20-30s; the RPC returns the
// newest block (~0-1s old) WITH all of its ~300 transactions in one call.
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RISE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`rpc ${method} -> ${res.status}`);
  const json = (await res.json()) as { result: T; error?: { message: string } };
  if (json.error) throw new Error(`rpc ${method}: ${json.error.message}`);
  return json.result;
}

interface RpcTx {
  hash: string;
  from: string;
  to: string | null;
  input: string;
  value: string;
  transactionIndex: string;
}
interface RpcBlock {
  number: string;
  hash: string;
  timestamp: string;
  transactions: RpcTx[];
}

export interface ChainHead {
  block: BlockRow;
  txns: TxRow[];
}

const BLOCK_SPREAD_MS = 1000; // approx inter-block interval used to spread txns

export async function getChainHead(): Promise<ChainHead> {
  const b = await rpc<RpcBlock>("eth_getBlockByNumber", ["latest", true]);
  const height = parseInt(b.number, 16);
  const timestampMs = parseInt(b.timestamp, 16) * 1000;
  const txs = b.transactions ?? [];
  const total = txs.length;
  return {
    block: {
      height,
      hash: b.hash,
      txCount: total,
      timestampMs,
      gasUsed: 0,
      gasLimit: 0,
    },
    // The chain only timestamps at block (second) granularity, so all txns in a
    // block share one time. We spread them across the block's ~1s window by
    // their real execution order (transactionIndex) so the feed reads as a
    // smooth ms ladder instead of one flat band. Last-executed = newest.
    txns: txs.map((t) => {
      const idx = parseInt(t.transactionIndex ?? "0x0", 16);
      const frac = total > 1 ? idx / (total - 1) : 1;
      const txTime = timestampMs - Math.round((1 - frac) * BLOCK_SPREAD_MS);
      return {
        hash: t.hash,
        method:
          t.input && t.input.length >= 10
            ? t.input.slice(0, 10)
            : t.to
              ? "transfer"
              : "—",
        from: t.from,
        to: t.to,
        timestampMs: txTime,
        value: t.value,
        blockNumber: height,
      };
    }),
  };
}

// ── single tx lookup (for the tx-hash search) ─────────────────
export interface TxDetail {
  hash: string;
  status: string | null;
  method: string | null;
  from: string;
  to: string | null;
  value: string;
  blockNumber: number | null;
  timestampMs: number;
  gasUsed: string | null;
  fee: string | null;
  found: boolean;
}

export async function getTx(hash: string): Promise<TxDetail | null> {
  try {
    const t = await bs<{
      hash: string;
      status: string | null;
      method: string | null;
      from: { hash: string } | null;
      to: { hash: string } | null;
      value: string;
      block_number?: number | null;
      timestamp: string;
      gas_used: string | null;
      fee?: { value: string } | null;
    }>(`/transactions/${hash}`, 5);
    return {
      hash: t.hash,
      status: t.status,
      method: t.method,
      from: t.from?.hash ?? "",
      to: t.to?.hash ?? null,
      value: t.value ?? "0",
      blockNumber: t.block_number ?? null,
      timestampMs: t.timestamp ? new Date(t.timestamp).getTime() : 0,
      gasUsed: t.gas_used,
      fee: t.fee?.value ?? null,
      found: true,
    };
  } catch {
    return null;
  }
}
