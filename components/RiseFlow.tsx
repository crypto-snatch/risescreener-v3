"use client";

import { useEffect, useRef, useState } from "react";
import { RISE_WS } from "@/lib/constants";
import { compact } from "@/lib/format";

// Auto-playing explainer: left = the steps of how RISE works (top→bottom),
// right = a live motion illustrating the currently-active step.
const STEP_MS = 4000;

type Kind = "submit" | "organize" | "pevm" | "shred" | "block" | "settle";
interface Step {
  k: Kind;
  title: string;
  desc: string;
}
const STEPS: Step[] = [
  {
    k: "submit",
    title: "1 · Trade submitted",
    desc: "Your order is sent to the RISE sequencer's mempool — the pool of pending transactions waiting to be processed. On RISE that wait is measured in milliseconds, not seconds, so trading feels instant.",
  },
  {
    k: "organize",
    title: "2 · Transaction organizer",
    desc: "A transaction organizer clusters non-conflicting trades together. Orders that touch different markets or accounts can run side-by-side without colliding — which unlocks massive parallelism in the next step.",
  },
  {
    k: "pevm",
    title: "3 · Parallel EVM (pEVM)",
    desc: "The parallel EVM executes those grouped trades across many CPU cores at the same time — deterministically, so every node computes the identical result. This parallelism is the core of RISE's Gigagas throughput.",
  },
  {
    k: "shred",
    title: "4 · Shred · instant preconfirmation",
    desc: "The moment a batch is executed it's streamed out as a shred — a sub-block with no state root yet — in about 2ms. That shred is your instant preconfirmation: the trade feels final immediately, long before the block closes.",
  },
  {
    k: "block",
    title: "5 · Block sealed (~1s)",
    desc: "Roughly once a second, the stream of shreds is aggregated into a full block with a computed state root. This is finality on RISE — the canonical, verifiable record of everything that happened.",
  },
  {
    k: "settle",
    title: "6 · Settle to Ethereum",
    desc: "The sealed block is posted to Ethereum L1. RISE is an Ethereum L2, so it inherits Ethereum's security and decentralization underneath a web2-speed execution layer up top.",
  },
];

export default function RiseFlow() {
  const [active, setActive] = useState(0);
  const [prog, setProg] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [tps, setTps] = useState(0);
  const [shredRate, setShredRate] = useState(0);
  const [block, setBlock] = useState(0);
  const sec = useRef(0);
  const shredSec = useRef(0);
  const elapsed = useRef(0);
  const lastTs = useRef(Date.now());
  const playingRef = useRef(true);
  playingRef.current = playing;

  // auto-advance + progress (pausable)
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      const dt = now - lastTs.current;
      lastTs.current = now;
      if (!playingRef.current) return;
      elapsed.current += dt;
      if (elapsed.current >= STEP_MS) {
        elapsed.current = 0;
        setActive((a) => (a + 1) % STEPS.length);
      }
      setProg(Math.min(1, elapsed.current / STEP_MS));
    }, 60);
    return () => clearInterval(tick);
  }, []);

  const goTo = (i: number) => {
    setActive(i);
    elapsed.current = 0;
    setProg(0);
  };

  // live data
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    const t = setInterval(() => {
      setTps(sec.current);
      sec.current = 0;
      setShredRate(shredSec.current);
      shredSec.current = 0;
    }, 1000);
    function connect() {
      try {
        ws = new WebSocket(RISE_WS);
      } catch {
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
        sec.current += r.transactions?.length ?? 0;
        shredSec.current += 1;
        if (r.blockNumber) setBlock(r.blockNumber);
      };
      ws.onclose = () => {
        if (!closed) setTimeout(connect, 1500);
      };
    }
    connect();
    return () => {
      closed = true;
      clearInterval(t);
      try {
        ws?.close();
      } catch {}
    };
  }, []);

  const live: Record<Kind, string | null> = {
    submit: null,
    organize: null,
    pevm: `~${compact(tps)} tx/s in parallel`,
    shred: `~${shredRate} shreds/s`,
    block: `block #${block ? block.toLocaleString() : "—"}`,
    settle: null,
  };
  const step = STEPS[active];

  return (
    <div className="glass glow-edge" style={{ padding: "16px 18px", borderRadius: "var(--r-lg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)" }}>How RISE works</span>
          <button onClick={() => setPlaying((pl) => !pl)} className="chip tag-accent" style={{ cursor: "pointer", fontSize: 10.5 }}>{playing ? "⏸ pause" : "▶ play"}</button>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          <b className="text-accent tnum">{compact(tps)}</b> tx/s · <b className="text-accent tnum">{shredRate}</b> shreds/s · block <b className="tnum">#{block ? block.toLocaleString() : "—"}</b>
        </span>
      </div>

      <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${prog * 100}%`, background: "var(--accent)", transition: "width .1s linear" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.25fr)", gap: 18, height: 340 }}>
        {/* vertical steps — titles only, evenly distributed */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", overflow: "hidden" }}>
          {STEPS.map((s, i) => {
            const on = i === active;
            return (
              <button
                key={s.k}
                onClick={() => goTo(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  background: on ? "var(--accent-soft)" : "transparent",
                  border: "1px solid " + (on ? "var(--accent-line)" : "transparent"),
                  borderLeft: "2px solid " + (on ? "var(--accent)" : "transparent"),
                  borderRadius: "var(--radius)",
                  padding: "12px 14px",
                  transition: "background .2s ease, border-color .2s ease",
                }}
              >
                <span style={{ fontSize: 17, fontWeight: 700, color: on ? "var(--accent-ink)" : "var(--ink)", opacity: on ? 1 : 0.66 }}>{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* live illustration for the active step (fixed height → no layout jump) */}
        <div className="glass" style={{ borderRadius: "var(--radius)", padding: "14px 16px", display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <Illustration kind={step.k} />
          </div>
          <div style={{ borderTop: "1px solid var(--hair-soft)", paddingTop: 12, height: 140, overflow: "hidden", flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-ink)" }}>{step.title}</div>
            <div style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 6, lineHeight: 1.6 }}>{step.desc}</div>
            {live[step.k] && <div className="tnum" style={{ fontSize: 11.5, color: "var(--accent-ink)", marginTop: 8 }}>● live · {live[step.k]}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── per-step animated illustrations (key forces remount → restart animation) ── */
function Illustration({ kind }: { kind: Kind }) {
  return <div key={kind} style={{ width: "100%", display: "flex", justifyContent: "center" }}>{render(kind)}</div>;
}

const box: React.CSSProperties = { border: "1px solid var(--accent-line)", borderRadius: 6, background: "rgba(255,255,255,0.04)" };
const dot = (s = 10): React.CSSProperties => ({ width: s, height: s, borderRadius: "50%", background: "var(--accent)" });

function render(kind: Kind) {
  switch (kind) {
    case "submit":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={dot(12)} className="fly" />
          <div style={{ ...box, padding: "22px 30px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".1em" }}>Mempool</div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "center" }}>
              {[0, 1, 2, 3].map((i) => <span key={i} style={dot(8)} />)}
            </div>
          </div>
        </div>
      );
    case "organize":
      return (
        <div style={{ display: "flex", gap: 26 }}>
          {[0, 1].map((c) => (
            <div key={c} style={{ ...box, padding: 14, display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="gather" style={{ ...dot(9), ["--gx" as any]: `${(Math.random() * 40 - 20) | 0}px`, ["--gy" as any]: `${(Math.random() * 40 - 20) | 0}px`, animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
          ))}
        </div>
      );
    case "pevm":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, width: 260 }}>
          {[0, 1, 2, 3].map((l) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, color: "var(--muted-2)" }}>core {l}</span>
              <div style={{ flex: 1, height: 12, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                <div className="lane" style={{ height: "100%", background: "var(--accent)", animationDelay: `${l * 0.16}s` }} />
              </div>
            </div>
          ))}
        </div>
      );
    case "shred":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ ...box, padding: "16px 14px", fontSize: 10, color: "var(--muted)" }}>seq</div>
          <div style={{ position: "relative", width: 200, height: 60 }}>
            {[0, 1, 2, 3, 4].map((k) => (
              <span key={k} className="shred-tick" style={{ position: "absolute", left: k * 36, top: 28, width: 14, height: 5, borderRadius: 2, background: "var(--accent)", animationDelay: `${k * 0.18}s` }} />
            ))}
            <div style={{ position: "absolute", right: 0, top: 4, fontSize: 10, color: "var(--accent-ink)" }}>~2ms each</div>
          </div>
        </div>
      );
    case "block": {
      return (
        <div className="sealflash" style={{ ...box, padding: 14, width: 200 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {Array.from({ length: 48 }).map((_, i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: 2, background: "color-mix(in oklab, var(--accent) 55%, transparent)" }} />
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>shreds → block + state root</div>
        </div>
      );
    }
    case "settle":
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div className="dropin" style={{ ...box, padding: "14px 26px", fontSize: 11, color: "var(--accent-ink)", fontWeight: 700 }}>RISE block</div>
          <span style={{ fontSize: 16, color: "var(--muted)" }}>↓</span>
          <div style={{ border: "1px solid var(--hair)", borderRadius: 6, padding: "12px 30px", background: "rgba(255,255,255,0.03)", fontSize: 11, color: "var(--muted)", letterSpacing: ".08em" }}>ETHEREUM L1</div>
        </div>
      );
  }
}
