"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EXPLORER_UI, RISE_WS } from "@/lib/constants";
import { msAgo, shortAddr, shortHash } from "@/lib/format";
import { contractLabel, methodLabel } from "@/lib/labels";
import { Panel, LiveDot } from "@/components/ui";

type Mode = "txns" | "blocks";

interface TxRow {
  hash: string;
  from: string;
  to: string | null;
  method: string | null;
  status: number;
  arrivalMs: number;
}
interface BlockRow {
  height: number;
  txCount: number;
  blockTimestampMs: number;
  firstSeenMs: number;
}

const TX_CAP = 80;
const BLOCK_CAP = 40;
const FLUSH_MS = 50;
const FRESH = 700;
const COLS_B = "120px 96px 1fr 96px";
const COLS_T = "minmax(0,1.3fr) 92px 130px minmax(0,1.4fr)";

export default function ChainStream() {
  const [mode, setMode] = useState<Mode>("txns");
  const [txns, setTxns] = useState<TxRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [, setTick] = useState(0);
  const [count, setCount] = useState({ txns: 0, blocks: 0 });
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<"connecting" | "live" | "down">("connecting");

  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const txBuf = useRef<TxRow[]>([]);
  const curBlock = useRef<{ height: number; txCount: number; ts: number; seen: number } | null>(null);
  const seen = useRef<Set<string>>(new Set());

  // ── RISE shred WebSocket: the real-time (~2ms) source ──
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let gotData = false;
    function connect() {
      try {
        ws = new WebSocket(RISE_WS);
      } catch {
        setStatus("down");
        return;
      }
      ws.onopen = () => ws?.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["shreds"] }));
      ws.onmessage = (e) => {
        if (pausedRef.current) return;
        let m: any;
        try {
          m = JSON.parse(e.data as string);
        } catch {
          return;
        }
        if (m.method !== "eth_subscription") return;
        const r = m.params?.result;
        if (!r) return;
        if (!gotData) {
          gotData = true;
          setStatus("live");
        }
        const now = Date.now();
        const tsMs = (r.blockTimestamp || 0) * 1000;
        if (curBlock.current && curBlock.current.height !== r.blockNumber) {
          const b = curBlock.current;
          setBlocks((prev) => [{ height: b.height, txCount: b.txCount, blockTimestampMs: b.ts, firstSeenMs: b.seen }, ...prev].slice(0, BLOCK_CAP));
          setCount((c) => ({ ...c, blocks: c.blocks + 1 }));
          curBlock.current = null;
        }
        if (!curBlock.current) curBlock.current = { height: r.blockNumber, txCount: 0, ts: tsMs, seen: now };
        const txs = r.transactions || [];
        curBlock.current.txCount += txs.length;
        for (const w of txs) {
          const t = w.transaction || w;
          if (!t?.hash || seen.current.has(t.hash)) continue;
          seen.current.add(t.hash);
          txBuf.current.push({
            hash: t.hash,
            from: t.signer || t.from || "",
            to: t.to,
            method: t.input && t.input.length >= 10 ? t.input.slice(0, 10) : t.to ? "transfer" : "—",
            status: w.receipt?.status === "0x1" ? 1 : 0,
            arrivalMs: now,
          });
        }
        if (seen.current.size > 12000) seen.current = new Set(txBuf.current.map((t) => t.hash));
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        if (closed) return;
        setStatus((s) => (s === "live" ? "live" : "down"));
        setTimeout(connect, 1500);
      };
    }
    connect();
    return () => {
      closed = true;
      try {
        ws?.close();
      } catch {}
    };
  }, []);

  // ── flush buffered txns + tick the age clock ──
  useEffect(() => {
    const t = setInterval(() => {
      setTick((n) => n + 1);
      if (!pausedRef.current && txBuf.current.length) {
        const batch = txBuf.current;
        txBuf.current = [];
        setCount((c) => ({ ...c, txns: c.txns + batch.length }));
        setTxns((prev) => [...batch.reverse(), ...prev].slice(0, TX_CAP));
      }
    }, FLUSH_MS);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  return (
    <Panel data-component="chain-stream" style={{ borderRadius: "var(--r-lg)" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--hair)", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <LiveDot paused={paused || status !== "live"} />
          <div style={{ display: "flex", border: "1px solid var(--hair)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
            {([["blocks", "Blocks"], ["txns", "Transactions"]] as [Mode, string][]).map(([m, label], i) => {
              const on = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 15px", border: "none",
                    borderRight: i === 0 ? "1px solid var(--hair)" : "none",
                    fontSize: 12.5, fontWeight: 700, letterSpacing: ".01em",
                    color: on ? "var(--accent-ink)" : "var(--muted)",
                    background: on ? "var(--accent-soft)" : "transparent",
                    transition: "color .15s ease, background .15s ease",
                  }}
                >
                  <span style={{ width: 5, height: 5, background: on ? "var(--accent)" : "var(--muted-2)", display: "inline-block" }} />
                  {label}
                </button>
              );
            })}
          </div>
          <span className="tnum" style={{ fontSize: 11, color: "var(--muted-2)" }}>
            {count[mode].toLocaleString()} {mode} streamed · shreds
          </span>
        </div>
        <button onClick={() => setPaused((v) => !v)} className="chip" style={{ borderColor: paused ? "var(--hair)" : "var(--accent-line)", color: paused ? "var(--muted)" : "var(--accent-ink)" }}>
          {paused ? "▶ resume" : "⏸ pause"}
        </button>
      </div>

      {mode === "blocks" ? (
        <div data-table="blocks">
          <div className="row head" style={{ gridTemplateColumns: COLS_B }}>
            <span>Block</span><span>Age</span><span>Block time · UTC</span><span style={{ textAlign: "right" }}>Txns</span>
          </div>
          <div style={{ height: 470, overflowY: "auto" }}>
            {blocks.length === 0 && <Loading status={status} />}
            {blocks.map((b) => (
              <div key={b.height} className={"row" + (now - b.firstSeenMs < FRESH ? " flashin" : "")} style={{ gridTemplateColumns: COLS_B }}>
                <a className="mono-link tnum" href={`${EXPLORER_UI}/block/${b.height}`} target="_blank" rel="noreferrer">{b.height.toLocaleString()}</a>
                <span className="text-muted tnum">{msAgo(b.firstSeenMs)}</span>
                <span className="text-muted tnum" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{new Date(b.blockTimestampMs).toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" })}</span>
                <span className="tnum" style={{ textAlign: "right" }}>{b.txCount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div data-table="txns">
          <div className="row head" style={{ gridTemplateColumns: COLS_T }}>
            <span>Tx Hash</span><span>Age</span><span>Method</span><span>Signer → To</span>
          </div>
          <div style={{ height: 470, overflowY: "auto" }}>
            {txns.length === 0 && <Loading status={status} />}
            {txns.map((t) => (
              <div key={t.hash} className={"row" + (now - t.arrivalMs < FRESH ? " flashin" : "")} style={{ gridTemplateColumns: COLS_T }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0, background: t.status ? "var(--long)" : "color-mix(in oklab, var(--short) 70%, transparent)" }} />
                  <a className="mono-link" href={`${EXPLORER_UI}/tx/${t.hash}`} target="_blank" rel="noreferrer" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortHash(t.hash)}</a>
                </span>
                <span className="text-muted tnum">{msAgo(t.arrivalMs)}</span>
                <span className="chip" style={{ justifySelf: "start", maxWidth: "100%" }}>{methodLabel(t.method)}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)" }}>
                  <Link className="mono-link" href={`/address/${t.from}`} style={{ color: "var(--ink)" }}>{shortAddr(t.from)}</Link>
                  <span className="text-accent"> → </span>
                  <span className="text-accent">{contractLabel(t.to)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Loading({ status }: { status: string }) {
  return (
    <div style={{ padding: "44px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
      {status === "down" ? "reconnecting to RISE shred stream…" : "subscribing to RISE shreds…"}
    </div>
  );
}
