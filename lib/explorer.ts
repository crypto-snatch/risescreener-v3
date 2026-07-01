import { EXPLORER_API, CONTRACTS } from "./constants";

interface BsTx {
  from: { hash: string };
  to: { hash: string } | null;
  hash: string;
  timestamp: string;
}

async function bs<T>(path: string, revalidate = 15): Promise<T> {
  const res = await fetch(`${EXPLORER_API}${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`explorer ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

// Real user wallets = addresses that sent txs to CollateralManager (deposits)
// and to PerpsManager (order flow). De-duplicated, newest first.
export async function discoverActiveAccounts(limit = 40): Promise<string[]> {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const sources = [CONTRACTS.CollateralManager, CONTRACTS.PerpsManager];
  for (const addr of sources) {
    try {
      const data = await bs<{ items: BsTx[] }>(
        `/addresses/${addr}/transactions?filter=to`,
        20,
      );
      for (const tx of data.items ?? []) {
        const f = tx.from?.hash?.toLowerCase();
        if (f && !seen.has(f)) {
          seen.add(f);
          ordered.push(tx.from.hash);
        }
        if (ordered.length >= limit) break;
      }
    } catch {
      /* explorer hiccup — skip this source */
    }
    if (ordered.length >= limit) break;
  }
  return ordered.slice(0, limit);
}

export interface AddrTx {
  hash: string;
  from: string;
  to: string | null;
  method: string | null;
  timestamp: string;
  status?: string;
}

// Raw recent transactions for a wallet (the "촤라락" tx feed, hypurrscan-style)
export async function getAddressTxns(addr: string, limit = 40): Promise<AddrTx[]> {
  try {
    const data = await bs<{
      items: (BsTx & { method: string | null; status?: string })[];
    }>(`/addresses/${addr}/transactions`, 8);
    return (data.items ?? []).slice(0, limit).map((t) => ({
      hash: t.hash,
      from: t.from?.hash ?? "",
      to: t.to?.hash ?? null,
      method: t.method ?? null,
      timestamp: t.timestamp,
      status: t.status,
    }));
  } catch {
    return [];
  }
}
