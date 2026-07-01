import { getSnapshot, type SnapshotRow } from "@/lib/snapshot";
import { getWalletStats } from "@/lib/analytics";
import { getDune, type DuneData } from "@/lib/dune";
import { usd, compact } from "@/lib/format";
import { Panel, Stat, SectionLabel } from "@/components/ui";
import TopWallets, { type TopRow } from "@/components/TopWallets";
import WalletTrends from "@/components/WalletTrends";

export const revalidate = 30;
export const metadata = { title: "Traders — RiseScreener" };

// New traders in the last full UTC day, from Dune's daily account series
// (RISEx's /v1/stats/wallets now requires auth → 401). The final entry is the
// in-progress current UTC day (a partial bucket), so we take the last complete one.
function newTraders24h(dune: DuneData | null): number | null {
  if (!dune?.accounts?.length) return null;
  const startTodayUTC = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const complete = dune.accounts.filter((a) => a.t < startTodayUTC);
  const last = complete[complete.length - 1];
  return last ? last.newAccounts : null;
}

export default async function TradersPage() {
  const [snap, wallets, dune] = await Promise.all([getSnapshot(), getWalletStats(), getDune()]);
  // /v1/stats/wallets is 401 now; Dune's cumulative account count is the canonical
  // figure (same source the Overview "Accounts" stat uses), with local fallbacks.
  const totalTraders = dune?.totals.accounts ?? snap?.totalAccounts ?? wallets.total;
  const newTraders = newTraders24h(dune);

  const sub = (r: SnapshotRow) =>
    r.top ? `${r.top.side === "long" ? "LONG" : "SHORT"} ${r.top.symbol} ${r.top.lev.toFixed(0)}×` : `${r.positionCount} positions`;
  const map = (rows: SnapshotRow[], val: (r: SnapshotRow) => string, tone?: (r: SnapshotRow) => "long" | "short"): TopRow[] =>
    rows.slice(0, 8).map((r) => ({ account: r.account, value: val(r), sub: sub(r), tone: tone?.(r) }));

  const byVolume = snap ? map(snap.byVolume, (r) => usd(r.volume)) : [];
  const byUpnl = snap ? map(snap.byUpnl, (r) => usd(r.uPnl, { sign: true }), (r) => (r.uPnl >= 0 ? "long" : "short")) : [];
  const byOI = snap ? map(snap.byOI, (r) => usd(r.oi)) : [];

  return (
    <div className="screen" data-page="traders" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Traders</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 10 }}>
        <Stat big label="Total traders" value={compact(totalTraders)} />
        <Stat
          big
          label="New traders (24h)"
          value={newTraders != null ? `+${compact(newTraders)}` : "—"}
          tone={newTraders != null ? "long" : undefined}
          hint={newTraders != null ? "last full UTC day" : "accumulating history"}
        />
        {snap && <Stat big label="With open positions" value={compact(snap.accountsWithPositions)} />}
      </div>

      {snap?.leaderTrends && (
        <div>
          <SectionLabel>
            Leaderboard trends · top 10 wallets · 30d
            {snap.sampled && <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>indexed sample</span>}
          </SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px,1fr))", gap: 16, alignItems: "stretch" }}>
            <WalletTrends title="Volume · top 10 combined (30d)" series={snap.leaderTrends.volume} filename="risescreener-top-volume" color="#34cfa2" />
            <WalletTrends title="Realized PnL · top 10 combined (30d)" series={snap.leaderTrends.pnl} filename="risescreener-top-pnl" sign color="#7d93c8" />
            <WalletTrends title="Open interest · top 10 combined (reconstructed)" series={snap.leaderTrends.oi} filename="risescreener-top-oi" color="#f7931a" />
          </div>
          <p style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 10 }}>
            Volume &amp; realized PnL rebuilt from each wallet&apos;s fills over 30 days. OI is reconstructed from net fills (approximate) — RISEx has no per-wallet history API.
          </p>
        </div>
      )}

      <SectionLabel>Top active traders {snap ? `· indexed across ${snap.totalAccounts.toLocaleString()} accounts` : ""}</SectionLabel>
      {snap ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 14 }}>
          <TopWallets title="24h volume" metric="turnover" rows={byVolume} />
          <TopWallets title="Unrealized PnL" metric="uPnL" rows={byUpnl} />
          <TopWallets title="Open interest" metric="OI" rows={byOI} />
        </div>
      ) : (
        <Panel pad="26px"><span className="text-muted" style={{ fontSize: 13 }}>Leaderboard snapshot not generated yet — run the indexer (`npm run index`).</span></Panel>
      )}

      <p style={{ fontSize: 11, color: "var(--muted-2)" }}>
        Wallet addresses are clickable → full account view (positions, fills, orders, txns) in the Explorer.
        Near-liquidation &amp; high-leverage screens are coming from the same indexer.
      </p>
    </div>
  );
}
