import { getSnapshot, type SnapshotRow } from "@/lib/snapshot";
import { getDune, type DuneData } from "@/lib/dune";
import { usd, compact } from "@/lib/format";
import { Panel, Stat, SectionLabel } from "@/components/ui";
import TopWallets, { type TopRow } from "@/components/TopWallets";
import WalletTrends from "@/components/WalletTrends";
import { LeverageDistributionChart, type LeverageBucket } from "@/components/QuantViz";
import ChartCard from "@/components/ChartCard";

export const revalidate = 30;
export const metadata = { title: "Traders — RiseScreener" };

// Dune's account series is daily. Use the latest complete UTC bucket and expose
// its date in the UI instead of presenting a possibly stale bucket as a rolling
// "last 24 hours" measurement.
function latestAccountDay(dune: DuneData | null) {
  if (!dune?.accounts?.length) return null;
  const startTodayUTC = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  return dune.accounts
    .filter((day) => day.t < startTodayUTC)
    .sort((a, b) => a.t - b.t)
    .at(-1) ?? null;
}

function utcStamp(value?: string | number) {
  if (value == null) return "unknown time";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "unknown time";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }) + " UTC";
}

export default async function TradersPage() {
  const [snap, dune] = await Promise.all([getSnapshot(), getDune()]);
  // These sources measure different universes. Dune is the cumulative protocol
  // account series; the position snapshot is an independently enumerated wallet
  // index. Keep both, but never imply that their denominators are identical.
  const totalAccounts = dune?.totals.accounts ?? snap?.totalAccounts ?? 0;
  const accountDay = latestAccountDay(dune);
  const scoredAccounts = snap?.scoredAccounts ?? snap?.totalAccounts ?? 0;

  const sub = (r: SnapshotRow) =>
    r.top ? `${r.top.side === "long" ? "LONG" : "SHORT"} ${r.top.symbol} ${r.top.lev.toFixed(0)}×` : `${r.positionCount} positions`;
  const map = (rows: SnapshotRow[], val: (r: SnapshotRow) => string, tone?: (r: SnapshotRow) => "long" | "short"): TopRow[] =>
    rows.slice(0, 8).map((r) => ({ account: r.account, value: val(r), sub: sub(r), tone: tone?.(r) }));

  const byVolume = snap ? map(snap.byVolume, (r) => usd(r.volume)) : [];
  const byUpnl = snap ? map(snap.byUpnl, (r) => usd(r.uPnl, { sign: true }), (r) => (r.uPnl >= 0 ? "long" : "short")) : [];
  const byOI = snap ? map(snap.byOI, (r) => usd(r.oi)) : [];
  const leverageBuckets: LeverageBucket[] = buildLeverageBuckets(snap?.byOI ?? []);

  return (
    <div className="screen" data-page="traders" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Trader activity</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 10 }}>
        <Stat
          big
          label="Cumulative accounts"
          value={compact(totalAccounts)}
          hint={accountDay ? `Dune account index · through ${utcStamp(accountDay.t)}` : "Dune account index"}
        />
        <Stat
          big
          label="Daily active accounts"
          value={accountDay ? compact(accountDay.activeTraders) : "—"}
          tone={accountDay ? "long" : undefined}
          hint={accountDay ? `${utcStamp(accountDay.t)} · +${compact(accountDay.newAccounts)} newly indexed` : "daily index unavailable"}
        />
        {snap && (
          <Stat
            big
            label="Open-position accounts"
            value={compact(snap.accountsWithPositions)}
            hint={`${scoredAccounts.toLocaleString()} accounts scanned · ${utcStamp(snap.generatedAt)}`}
          />
        )}
      </div>

      {snap?.leaderTrends && (
        <div>
          <SectionLabel>
            Indexed account leaders · latest snapshot
            {snap.sampled && <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>indexed sample</span>}
          </SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px,1fr))", gap: 16, alignItems: "stretch" }}>
            <WalletTrends title="Recent volume leaders" subtitle="Top 10 · latest 200 fills per account" series={snap.leaderTrends.volume} filename="risescreener-top-volume" color="#34cfa2" />
            <WalletTrends title="Realized PnL leaders" subtitle="Top 10 · latest 200 fills per account" series={snap.leaderTrends.pnl} filename="risescreener-top-pnl" sign color="#7d93c8" />
            <WalletTrends title="Open interest leaders" subtitle={`Top 10 · position snapshot ${utcStamp(snap.generatedAt)}`} series={snap.leaderTrends.oi} filename="risescreener-top-oi" color="#f7931a" />
          </div>
          <p style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 10 }}>
            The latest public snapshot contains ranked totals but no daily leader-series rows, so ranked bars are shown instead of an empty or invented timeline.
            Volume and realized PnL are bounded by the API&apos;s latest-200-fill response; OI is the directly indexed open-position notional at snapshot time.
          </p>
        </div>
      )}

      {leverageBuckets.some((bucket) => bucket.long + bucket.short > 0) && (
        <div>
          <SectionLabel>Leverage distribution · largest open-interest wallets</SectionLabel>
          <div className="leverage-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(260px,.45fr)", gap: 16 }}>
            <ChartCard
              title="Leverage distribution"
              subtitle="Largest position per top-OI wallet · notional split by direction"
              height={320}
              modalHeight={480}
              filename="risescreener-leverage-distribution"
            >
              <LeverageDistributionChart buckets={leverageBuckets} valueMode="notional" height={320} />
            </ChartCard>
            <Panel pad="18px" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "var(--muted)", fontSize: 11, letterSpacing: ".11em", textTransform: "uppercase" }}>Reading the shape</div>
                <h3 style={{ margin: "14px 0 8px", fontSize: 20, fontWeight: 550, letterSpacing: "-.035em" }}>Leverage is asymmetric risk.</h3>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 11.5, lineHeight: 1.65 }}>
                  Bars show the largest position per top-OI wallet, split by direction and weighted by notional.
                  They are a concentration lens, not a full-account census.
                </p>
              </div>
              <span className="chip" style={{ alignSelf: "flex-start", marginTop: 18 }}>indexed sample · {snap?.byOI.length ?? 0} wallets</span>
            </Panel>
          </div>
        </div>
      )}

      <SectionLabel>Indexed account rankings {snap ? `· ${scoredAccounts.toLocaleString()} accounts scanned` : ""}</SectionLabel>
      {snap ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 14 }}>
          <TopWallets title="Recent volume" metric="latest 200 fills" rows={byVolume} />
          <TopWallets title="Unrealized PnL" metric="uPnL" rows={byUpnl} />
          <TopWallets title="Open interest" metric="OI" rows={byOI} />
        </div>
      ) : (
        <Panel pad="26px"><span className="text-muted" style={{ fontSize: 13 }}>Leaderboard snapshot not generated yet — run the indexer (`npm run index`).</span></Panel>
      )}

      <p style={{ fontSize: 11, color: "var(--muted-2)" }}>
        Wallet addresses are clickable → full account view (positions, fills, orders, txns) in the Explorer.
        Rankings and open-position counts are point-in-time index results, not live exchange-wide counters.
      </p>
    </div>
  );
}

function buildLeverageBuckets(rows: SnapshotRow[]): LeverageBucket[] {
  const definitions = [
    { label: "≤2×", min: 0, max: 2 },
    { label: "2–5×", min: 2, max: 5 },
    { label: "5–10×", min: 5, max: 10 },
    { label: "10–20×", min: 10, max: 20 },
    { label: "20×+", min: 20, max: Number.POSITIVE_INFINITY },
  ];
  return definitions.map((definition) => {
    const matches = rows.filter((row) => row.top && row.top.lev > definition.min && row.top.lev <= definition.max);
    return {
      label: definition.label,
      long: matches.filter((row) => row.top?.side === "long").reduce((sum, row) => sum + (row.top?.notional ?? 0), 0),
      short: matches.filter((row) => row.top?.side === "short").reduce((sum, row) => sum + (row.top?.notional ?? 0), 0),
    };
  });
}
