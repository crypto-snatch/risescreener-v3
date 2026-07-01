import {
  getPositions,
  getFills,
  getBalance,
  getOpenOrders,
  getMarketMap,
  getMark,
  enrichPosition,
  symbolOf,
  type Position,
  type RawFill,
  type RawOpenOrder,
} from "./risex";
import { getAddressTxns, discoverActiveAccounts, type AddrTx } from "./explorer";
import { num } from "./format";

export interface AccountSnapshot {
  account: string;
  balance: number;
  positions: Position[];
  fills: RawFill[];
  orders: RawOpenOrder[];
  txns: AddrTx[];
  totals: {
    notional: number;
    uPnl: number;
    fills: number;
  };
}

export async function getAccountSnapshot(
  account: string,
  opts: { withTxns?: boolean } = {},
): Promise<AccountSnapshot> {
  const [rawPositions, fills, balance, orders, marketMap] = await Promise.all([
    getPositions(account).catch(() => []),
    getFills(account, 60).catch(() => []),
    getBalance(account).catch(() => 0),
    getOpenOrders(account).catch(() => []),
    getMarketMap(),
  ]);

  // marks only for markets the account holds
  const marketIds = Array.from(new Set(rawPositions.map((p) => p.market_id)));
  const markPairs = await Promise.all(
    marketIds.map(async (id) => [id, await getMark(id)] as const),
  );
  const marks = new Map(markPairs);

  const positions = rawPositions
    .filter((p) => num(p.size) !== 0)
    .map((p) => {
      const m = marketMap.get(String(p.market_id));
      const mmf = num(m?.config?.maintenance_margin_factor);
      return enrichPosition(p, symbolOf(m), marks.get(p.market_id) ?? 0, mmf);
    })
    .sort((a, b) => b.notional - a.notional);

  const txns = opts.withTxns ? await getAddressTxns(account, 40) : [];

  return {
    account,
    balance,
    positions,
    fills,
    orders,
    txns,
    totals: {
      notional: positions.reduce((s, p) => s + p.notional, 0),
      uPnl: positions.reduce((s, p) => s + p.uPnl, 0),
      fills: fills.length,
    },
  };
}

export interface TraderRow {
  account: string;
  balance: number;
  notional: number; // open interest (current open position notional)
  uPnl: number;
  volume: number; // traded volume from recent fills (turnover)
  positionCount: number;
  top?: Position;
}

// Discover active wallets on-chain, then score them by live position size.
// This is the "whale board" — only wallets with at least one open position.
export async function getLeaderboard(max = 36): Promise<TraderRow[]> {
  const accounts = await discoverActiveAccounts(max).catch(() => []);
  const marketMap = await getMarketMap();
  const markCache = new Map<string, number>();

  async function markFor(id: string): Promise<number> {
    if (markCache.has(id)) return markCache.get(id)!;
    const m = await getMark(id);
    markCache.set(id, m);
    return m;
  }

  const rows = await Promise.all(
    accounts.map(async (account): Promise<TraderRow | null> => {
      const [rawPositions, balance, fills] = await Promise.all([
        getPositions(account).catch(() => []),
        getBalance(account).catch(() => 0),
        getFills(account, 200).catch(() => []),
      ]);
      // 24h traded volume (turnover): fills within the last 24h (time is ns)
      const cutoffNs = Date.now() * 1e6 - 24 * 60 * 60 * 1e9;
      const volume = fills
        .filter((f) => num(f.time) >= cutoffNs)
        .reduce((s, f) => s + num(f.price) * num(f.size), 0);
      const live = rawPositions.filter((p) => num(p.size) !== 0);
      if (live.length === 0) {
        return balance > 0 || volume > 0
          ? { account, balance, notional: 0, uPnl: 0, volume, positionCount: 0 }
          : null;
      }
      const positions = await Promise.all(
        live.map(async (p) => {
          const m = marketMap.get(String(p.market_id));
          const mmf = num(m?.config?.maintenance_margin_factor);
          return enrichPosition(p, symbolOf(m), await markFor(p.market_id), mmf);
        }),
      );
      positions.sort((a, b) => b.notional - a.notional);
      return {
        account,
        balance,
        notional: positions.reduce((s, p) => s + p.notional, 0),
        uPnl: positions.reduce((s, p) => s + p.uPnl, 0),
        volume,
        positionCount: positions.length,
        top: positions[0],
      };
    }),
  );

  return rows
    .filter((r): r is TraderRow => r !== null)
    .sort((a, b) => b.notional - a.notional);
}
