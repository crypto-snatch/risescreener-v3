"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RISE_WS, EXPLORER_UI } from "@/lib/constants";
import { msAgo, shortAddr, shortHash, compact } from "@/lib/format";
import { contractLabel } from "@/lib/labels";

// Left half = live feeds (blocks + transactions, "촤라락"); right half = TPS bars.
const BUCKETS = 48;
const FEED_CAP = 16;
const FLUSH_MS = 70;
const FRESH = 600;

interface TxRow {
  hash: string;
  from: string;
  to: string | null;
  arrivalMs: number;
}
interface BlockRow {
  height: number;
  txCount: number;
  arrivalMs: number;
}

export default function ShredPulse() {
  const [tps, setTps] = useState(0);
  const [peak, setPeak] = useState(0);
  const [block, setBlock] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(BUCKETS).fill(0));
  const [txns, setTxns] = useState<TxRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [, setTick] = useState(0);
  const [status, setStatus] = useState<"connecting" | "live" | "down">("connecting");

  const secCount = useRef(0);
  const txBuf = useRef<TxRow[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const lastBlock = useRef(0);
  const curBlockTx = useRef(0);
  const blockBuf = useRef<BlockRow[]>([]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    const flushBars = setInterval(() => {
      const c = secCount.current;
      secCount.current = 0;
      setTps(c);
      setPeak((p) => Math.max(p, c));
      setBars((prev) => [...prev.slice(1), c]);
    }, 1000);

    function connect() {
      try {
        ws = new WebSocket(RISE_WS);
      } catch {
        setStatus("down");
        return;
      }
      ws.onopen = () => ws?.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["shreds"] }));
      ws.onmessage = (e) => {
        let m: any;
        try {
          m = JSON.parse(e.data as string);
        } catch {
          return;
        }
        if (m.method !== "eth_subscription") return;
        const r = m.params?.result;
        if (!r) return;
        setStatus("live");
        const now = Date.now();
        const txs = r.transactions ?? [];
        const bn = r.blockNumber as number;
        secCount.current += txs.length;

        // block changed → seal previous block into the feed
        if (lastBlock.current && bn !== lastBlock.current) {
          blockBuf.current.push({ height: lastBlock.current, txCount: curBlockTx.current, arrivalMs: now });
          curBlockTx.current = 0;
        }
        lastBlock.current = bn;
        if (bn) setBlock(bn);
        curBlockTx.current += txs.length;

        for (const w of txs) {
          const t = w.transaction || w;
          if (!t?.hash || seen.current.has(t.hash)) continue;
          seen.current.add(t.hash);
          txBuf.current.push({ hash: t.hash, from: t.signer || t.from || "", to: t.to, arrivalMs: now });
        }
        if (seen.current.size > 8000) seen.current = new Set(txBuf.current.map((t) => t.hash));
      };
      ws.onclose = () => {
        if (closed) return;
        setStatus("down");
        setTimeout(connect, 1500);
      };
    }
    connect();

    const flushFeed = setInterval(() => {
      setTick((n) => n + 1);
      if (blockBuf.current.length) {
        const b = blockBuf.current;
        blockBuf.current = [];
        setBlocks((prev) => [...b.reverse(), ...prev].slice(0, FEED_CAP));
      }
      if (txBuf.current.length) {
        const b = txBuf.current;
        txBuf.current = [];
        setTxns((prev) => [...b.reverse(), ...prev].slice(0, FEED_CAP));
      }
    }, FLUSH_MS);

    return () => {
      closed = true;
      clearInterval(flushBars);
      clearInterval(flushFeed);
      try {
        ws?.close();
      } catch {}
    };
  }, []);

  const now = Date.now();
  const max = Math.max(1, ...bars);
  const FEED_H = 176;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
      {/* LEFT: Live Explorer */}
      <div className="glass glow-edge" data-component="live-explorer" style={{ padding: "14px 16px", borderRadius: "var(--r-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
          <span style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink)", fontWeight: 600 }}>Live Explorer</span>
          <Link href="/explorer" className="chip tag-accent" style={{ fontSize: 10.5 }}>block #{block ? block.toLocaleString() : "—"} · open ↗</Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, alignItems: "stretch" }}>
          {/* ① block feed (~1s) */}
          <Col label="Blocks">
          <div style={{ height: FEED_H, overflow: "hidden" }}>
            {blocks.length === 0 && <Waiting />}
            {blocks.map((b) => (
              <div key={b.height} className={now - b.arrivalMs < FRESH ? "flashin" : ""} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", fontSize: 11.5, padding: "3px 4px" }}>
                <a className="mono-link tnum" href={`${EXPLORER_UI}/block/${b.height}`} target="_blank" rel="noreferrer">#{b.height.toLocaleString()}</a>
                <span className="tnum" style={{ color: "var(--ink)" }}>{compact(b.txCount)} tx</span>
                <span className="tnum" style={{ fontSize: 9.5, color: "var(--muted)" }}>{msAgo(b.arrivalMs)}</span>
              </div>
            ))}
          </div>
        </Col>

        {/* ② tx feed (촤라락) */}
        <Col label="Transactions">
          <div style={{ height: FEED_H, overflow: "hidden" }}>
            {txns.length === 0 && <Waiting />}
            {txns.map((t) => (
              <div key={t.hash} className={now - t.arrivalMs < FRESH ? "flashin" : ""} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center", fontSize: 11, padding: "3px 4px" }}>
                <a className="mono-link" href={`${EXPLORER_UI}/tx/${t.hash}`} target="_blank" rel="noreferrer">{shortHash(t.hash)}</a>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>
                  <Link className="mono-link" href={`/address/${t.from}`} style={{ color: "var(--ink)" }}>{shortAddr(t.from)}</Link>
                  <span className="text-accent"> → </span>
                  <span className="text-accent">{contractLabel(t.to)}</span>
                </span>
              </div>
            ))}
          </div>
        </Col>

        </div>
      </div>

      {/* RIGHT: Shred Pulse */}
      <div className="glass glow-edge" data-component="shred-pulse" style={{ padding: "14px 16px", borderRadius: "var(--r-lg)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={"live-dot" + (status === "live" ? "" : " paused")}>
              {status === "live" && <i className="ping" />}
              <i />
            </span>
            <span style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink)", fontWeight: 600 }}>Shred Pulse</span>
          </span>
          <div style={{ display: "flex", gap: 18 }}>
            <Kpi label="TPS now" value={tps.toLocaleString()} tone />
            <Kpi label="peak" value={peak.toLocaleString()} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: FEED_H }}>
            {bars.map((bv, i) => (
              <div key={i} title={`${bv} tx`} style={{ flex: 1, height: `${(bv / max) * 100}%`, minHeight: 2, background: i === bars.length - 1 ? "var(--accent)" : "color-mix(in oklab, var(--accent) 42%, transparent)", borderRadius: 1, transition: "height .25s ease" }} />
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, textAlign: "right" }}>tx / second · last {BUCKETS}s</div>
        </div>
      </div>
    </div>
  );
}

function Col({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRight: "1px solid var(--hair-soft)", paddingRight: 14 }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
function Waiting() {
  return <div style={{ color: "var(--muted)", fontSize: 11, paddingTop: 8 }}>subscribing…</div>;
}
function Kpi({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 18, fontWeight: 700, color: tone ? "var(--accent-ink)" : "var(--ink)" }}>{value}</div>
    </div>
  );
}
