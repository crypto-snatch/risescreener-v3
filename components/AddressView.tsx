"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AccountSnapshot } from "@/lib/account";
import { EXPLORER_UI } from "@/lib/constants";
import { usd, usdFull, price, compact, num, nsToMs, timeAgo, shortAddr } from "@/lib/format";
import { Panel, Stat, SectionLabel, Empty } from "@/components/ui";
import ChartCard from "@/components/ChartCard";
import { Donut, AreaTrend } from "@/components/charts";

type Snap = AccountSnapshot & { symbols: Record<string, string> };

const COIN_COLOR: Record<string, string> = { BTC: "#f7931a", ETH: "#8aa0c8", SOL: "#14f195", HYPE: "#34cfa2" };
const PALETTE = ["#34cfa2", "#7d93c8", "#e8737f", "#c9a24b", "#5fb0d6", "#9b7dd6", "#6a7c8e", "#e0894b"];
const colorFor = (s: string, i: number) => COIN_COLOR[s] ?? PALETTE[i % PALETTE.length];

export default function AddressView({ addr, initial }: { addr: string; initial: Snap }) {
  const [snap, setSnap] = useState<Snap>(initial);
  const [tab, setTab] = useState<"fills" | "txns" | "orders">("fills");
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    async function pull() {
      try {
        const r = await fetch(`/api/address/${addr}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as Snap;
        if (alive && !(d as any).error) setSnap(d);
      } catch {}
    }
    const t = setInterval(pull, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [addr, live]);

  const sym = (id: string) => snap.symbols[id] ?? `#${id}`;

  // derived portfolio metrics
  const positions = snap.positions;
  const longUsd = positions.filter((p) => p.side === "long").reduce((s, p) => s + p.notional, 0);
  const shortUsd = positions.filter((p) => p.side === "short").reduce((s, p) => s + p.notional, 0);
  const totalNotional = longUsd + shortUsd;
  const marginUsed = positions.reduce((s, p) => s + p.margin, 0);
  const acctLev = snap.balance > 0 ? totalNotional / snap.balance : 0;
  const longPct = totalNotional > 0 ? (longUsd / totalNotional) * 100 : 50;
  const alloc = [...positions].sort((a, b) => b.notional - a.notional).map((p, i) => ({ name: p.symbol, value: p.notional, color: colorFor(p.symbol, i) }));
  const allocLegend = alloc.map((a) => ({ name: a.name, color: a.color, value: usd(a.value), pct: totalNotional > 0 ? (a.value / totalNotional) * 100 : 0 }));
  // daily traded volume from this wallet's recent fills
  const fillDaily = (() => {
    const m: Record<number, number> = {};
    for (const f of snap.fills) { const day = Math.floor(nsToMs(f.time) / 86400000) * 86400000; m[day] = (m[day] || 0) + num(f.price) * num(f.size); }
    return Object.entries(m).map(([t, v]) => ({ t: Number(t), v })).sort((a, b) => a.t - b.t);
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
        <Stat big label="Account value" value={usdFull(snap.balance)} tone="accent" />
        <Stat big label="Open notional" value={usd(snap.totals.notional)} />
        <Stat big label="Unrealized PnL" value={usd(snap.totals.uPnl, { sign: true })} tone={snap.totals.uPnl >= 0 ? "long" : "short"} />
        <Stat big label="Account leverage" value={`${acctLev.toFixed(1)}×`} hint="notional ÷ value" />
        <Stat big label="Margin used" value={usd(marginUsed)} />
        <Stat big label="Open positions" value={String(positions.length)} />
      </div>

      {/* portfolio charts */}
      {positions.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 16, alignItems: "stretch" }}>
          <ChartCard title="Position allocation" height={230} legend={allocLegend} filename={`risescreener-wallet-${addr.slice(0, 8)}`}>
            <Donut data={alloc} height="100%" />
          </ChartCard>
          <div className="glass glow-edge glass-raise" style={{ borderRadius: "var(--r-lg)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Directional exposure</div>
            <div>
              <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", background: "var(--glass-2)" }}>
                <span title={`Long ${usd(longUsd)}`} style={{ width: `${longPct}%`, background: "color-mix(in oklab, var(--long) 80%, transparent)", display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 11, color: "#06120d", fontWeight: 700 }}>{longPct >= 12 ? `${longPct.toFixed(0)}%` : ""}</span>
                <span title={`Short ${usd(shortUsd)}`} style={{ width: `${100 - longPct}%`, background: "color-mix(in oklab, var(--short) 76%, transparent)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, fontSize: 11, color: "#160607", fontWeight: 700 }}>{100 - longPct >= 12 ? `${(100 - longPct).toFixed(0)}%` : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                <span className="text-long tnum">Long {usd(longUsd)}</span>
                <span className="text-short tnum">Short {usd(shortUsd)}</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: "auto" }}>
              <MiniStat label="Largest position" value={alloc[0] ? `${alloc[0].name} ${usd(alloc[0].value)}` : "—"} />
              <MiniStat label="Avg leverage" value={positions.length ? `${(positions.reduce((s, p) => s + p.leverage, 0) / positions.length).toFixed(1)}×` : "—"} />
              <MiniStat label="Net funding" value={usd(positions.reduce((s, p) => s + p.funding, 0), { sign: true })} />
              <MiniStat label="Markets" value={String(new Set(positions.map((p) => p.symbol)).size)} />
            </div>
          </div>
        </div>
      )}

      {/* trading activity */}
      {fillDaily.length > 1 && (
        <div>
          <SectionLabel>Trading activity · daily volume from recent fills</SectionLabel>
          <ChartCard title="Daily traded volume" height={220} filename={`risescreener-wallet-vol-${addr.slice(0, 8)}`}>
            <AreaTrend data={fillDaily} xKey="t" yKey="v" yPreset="usd" valueName="Volume" height="100%" />
          </ChartCard>
        </div>
      )}

      {/* positions */}
      <section>
        <SectionLabel
          right={
            <button onClick={() => setLive((v) => !v)} className="chip" style={{ borderColor: live ? "var(--accent-line)" : "var(--hair)", color: live ? "var(--accent-ink)" : "var(--muted)" }}>
              {live ? "● live" : "○ paused"}
            </button>
          }
        >
          Open positions
        </SectionLabel>
        {snap.positions.length === 0 ? (
          <Empty>No open positions.</Empty>
        ) : (
          <Panel style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr>
                  <Th>Market</Th><Th>Side</Th><Th right>Size</Th><Th right>Entry</Th><Th right>Mark</Th><Th right>Liq.≈</Th><Th right>Notional</Th><Th right>uPnL</Th>
                </tr>
              </thead>
              <tbody>
                {snap.positions.map((p) => (
                  <tr key={p.marketId} style={{ borderBottom: "1px solid var(--hair-soft)" }}>
                    <Td><span style={{ fontWeight: 700 }}>{p.symbol}</span></Td>
                    <Td><span style={{ color: p.side === "long" ? "var(--long)" : "var(--short)", fontWeight: 600 }}>{p.side.toUpperCase()}</span> <span className="text-muted">{p.leverage.toFixed(0)}×</span></Td>
                    <Td right mono>{compact(p.size)}</Td>
                    <Td right mono>${price(p.entry)}</Td>
                    <Td right mono>${price(p.mark)}</Td>
                    <Td right mono color="var(--muted)">{p.liqApprox ? `$${price(p.liqApprox)}` : "—"}</Td>
                    <Td right mono>{usd(p.notional)}</Td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: p.uPnl >= 0 ? "var(--long)" : "var(--short)" }}>
                      {usd(p.uPnl, { sign: true })}
                      <span style={{ display: "block", fontSize: 10, opacity: 0.6 }}>{p.uPnlPct >= 0 ? "+" : ""}{p.uPnlPct.toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </section>

      {/* tabs */}
      <section>
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {([["fills", `Fills (${snap.fills.length})`], ["txns", "Transactions"], ["orders", `Open orders (${snap.orders.length})`]] as [typeof tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="pill" data-active={tab === k}>{l}</button>
          ))}
        </div>

        {tab === "fills" && (snap.fills.length === 0 ? <Empty>No fills yet.</Empty> : (
          <Panel style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 680 }}>
              <thead><tr><Th>Time</Th><Th>Market</Th><Th>Side</Th><Th right>Price</Th><Th right>Size</Th><Th right>Fee</Th><Th right>Realized</Th><Th>Type</Th><Th>Tx</Th></tr></thead>
              <tbody>
                {snap.fills.map((f) => {
                  const realized = num(f.realized_pnl);
                  return (
                    <tr key={f.id} style={{ borderBottom: "1px solid var(--hair-soft)" }}>
                      <Td color="var(--muted)">{timeAgo(nsToMs(f.time))}</Td>
                      <Td><span style={{ fontWeight: 700 }}>{sym(f.market_id)}</span></Td>
                      <Td><span style={{ color: f.side === "BUY" ? "var(--long)" : "var(--short)", fontWeight: 600 }}>{f.side}</span></Td>
                      <Td right mono>${price(num(f.price))}</Td>
                      <Td right mono>{compact(num(f.size))}</Td>
                      <Td right mono color="var(--muted)">${num(f.fee).toFixed(3)}</Td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: realized >= 0 ? "var(--long)" : "var(--short)" }}>{usd(realized, { sign: true })}</td>
                      <Td>{f.is_liquidation ? <span className="text-short" style={{ fontSize: 10.5, fontWeight: 600 }}>LIQ</span> : <span className="text-muted" style={{ fontSize: 10.5 }}>{f.liquidity_indicator}</span>}</Td>
                      <Td><a className="mono-link" href={`${EXPLORER_UI}/tx/${f.blockchain_data?.tx_hash}`} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>{f.blockchain_data?.tx_hash?.slice(0, 8)}…</a></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        ))}

        {tab === "txns" && (snap.txns.length === 0 ? <Empty>No recent transactions.</Empty> : (
          <Panel className="divide">
            {snap.txns.map((t) => (
              <a key={t.hash} href={`${EXPLORER_UI}/tx/${t.hash}`} target="_blank" rel="noreferrer" className="row-hover-link" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", fontSize: 12.5 }}>
                <span className="mono-link">{t.hash.slice(0, 14)}…</span>
                <span className="chip">{t.method ?? "call"}</span>
                <span className="text-muted">{t.timestamp ? timeAgo(new Date(t.timestamp).getTime()) : ""}</span>
              </a>
            ))}
          </Panel>
        ))}

        {tab === "orders" && (snap.orders.length === 0 ? <Empty>No open orders.</Empty> : (
          <Panel style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 480 }}>
              <thead><tr><Th>Market</Th><Th>Side</Th><Th right>Price</Th><Th right>Size</Th></tr></thead>
              <tbody>
                {snap.orders.map((o) => (
                  <tr key={o.order_id} style={{ borderBottom: "1px solid var(--hair-soft)" }}>
                    <Td><span style={{ fontWeight: 700 }}>{sym(o.market_id)}</span></Td>
                    <Td><span style={{ color: o.side === "BUY" ? "var(--long)" : "var(--short)", fontWeight: 600 }}>{o.side}</span></Td>
                    <Td right mono>${price(num(o.price))}</Td>
                    <Td right mono>{compact(num(o.remaining_size ?? o.size))}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ))}
      </section>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontWeight: 400, padding: "11px 14px", textAlign: right ? "right" : "left", whiteSpace: "nowrap", color: "var(--muted-2)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid var(--hair)" }}>{children}</th>;
}
function Td({ children, right, mono, color }: { children: React.ReactNode; right?: boolean; mono?: boolean; color?: string }) {
  return <td style={{ padding: "10px 14px", textAlign: right ? "right" : "left", whiteSpace: "nowrap", color: color || "var(--ink)", fontVariantNumeric: mono ? "tabular-nums" : "normal" }}>{children}</td>;
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted-2)" }}>{label}</span>
      <span className="tnum" style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
