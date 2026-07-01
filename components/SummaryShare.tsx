"use client";

import { useRef, useState } from "react";
import { toPng, toBlob } from "html-to-image";

type Kpi = { label: string; value: string; delta?: string; tone?: "pos" | "neg" };
type TopRow = { m: string; a: string; v: string };
type Top = { title: string; rows: TopRow[] };

// the card paints its own palette so the exported PNG looks identical
// regardless of the site's theme.
const ACC = "#34cfa2";
const POS = "#3fdd9a";
const NEG = "#ff6b7d";
const INK = "#e8ecf0";
const MUT = "#8b95a3";
const CARD_BG = "#0b0e13";
const HAIR = "rgba(255,255,255,0.07)";

export default function SummaryShare({ date, kpis24, kpisTotal, tops, text }: { date: string; kpis24: Kpi[]; kpisTotal: Kpi[]; tops: Top[]; text: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busyImg, setBusyImg] = useState(false);
  const [imgCopied, setImgCopied] = useState(false);

  const download = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: CARD_BG });
      const a = document.createElement("a");
      a.href = url;
      a.download = `risescreener-summary-${date.replace(/\s/g, "-")}.png`;
      a.click();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };
  const copyImage = async () => {
    if (!cardRef.current) return;
    setBusyImg(true);
    try {
      const blob = await toBlob(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: CARD_BG });
      if (blob && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setImgCopied(true);
        setTimeout(() => setImgCopied(false), 1600);
      }
    } catch (e) { console.error(e); } finally { setBusyImg(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
      {/* LEFT — capturable card (kept compact so it doesn't sprawl with empty space) */}
      <div style={{ flex: "1 1 460px", minWidth: 292, maxWidth: 620, display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          ref={cardRef}
          style={{
            position: "relative", overflow: "hidden", flex: 1,
            borderRadius: 12, padding: "22px 24px", color: INK,
            border: `1px solid ${HAIR}`,
            background: `radial-gradient(90% 70% at 0% 0%, rgba(52,207,162,0.10), transparent 52%), linear-gradient(165deg, #0d1017, ${CARD_BG} 70%)`,
            fontFamily: "var(--font)",
          }}
        >
          {/* faint mascot watermark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.png" alt="" style={{ position: "absolute", right: -30, bottom: -30, width: 168, height: 168, opacity: 0.06, pointerEvents: "none", objectFit: "cover" }} />

          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot.png" alt="" width={40} height={40} style={{ borderRadius: 8, border: `1px solid ${HAIR}`, flexShrink: 0, objectFit: "cover" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "0.04em", lineHeight: 1.1 }}>
                <span style={{ color: ACC }}>RISE</span><span>SCREENER</span>
              </div>
              <div style={{ fontSize: 9.5, color: MUT, letterSpacing: ".16em", textTransform: "uppercase", marginTop: 4 }}>RISEx · Daily Recap</div>
            </div>
            <div style={{ marginLeft: "auto", fontSize: 11, color: INK, border: `1px solid ${HAIR}`, borderRadius: 6, padding: "5px 11px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{date}</div>
          </div>

          {/* 24H + All-time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 12, alignItems: "start" }}>
            <KpiBlock heading="24H" kpis={kpis24} />
            <KpiBlock heading="All-time" kpis={kpisTotal} />
          </div>

          {/* top traders */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
            {tops.map((t) => (
              <div key={t.title} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${HAIR}`, borderRadius: 7, padding: "9px 10px" }}>
                <div style={{ fontSize: 9, color: ACC, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 7, fontWeight: 600 }}>{t.title}</div>
                {t.rows.length ? t.rows.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, padding: "2px 0" }}>
                    <span style={{ fontSize: 12 }}>{r.m}</span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{r.a}</span>
                    <span style={{ marginLeft: "auto", color: MUT, fontVariantNumeric: "tabular-nums" }}>{r.v}</span>
                  </div>
                )) : <div style={{ fontSize: 10.5, color: MUT }}>—</div>}
              </div>
            ))}
          </div>

          {/* footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 10.5, color: MUT }}>
            <span>risescreener.com</span>
            <span style={{ color: ACC }}>● live on-chain · RISE</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copyImage} disabled={busyImg} className="chip" style={{ padding: "9px 14px", fontSize: 12.5, borderColor: "var(--accent-line)", color: "var(--accent-ink)" }}>
            {busyImg ? "Copying…" : imgCopied ? "✓ Image copied" : "⧉ Copy image"}
          </button>
          <button onClick={download} disabled={busy} className="chip" style={{ padding: "9px 14px", fontSize: 12.5, borderColor: "var(--accent-line)", color: "var(--accent-ink)" }}>
            {busy ? "Rendering…" : "↓ Download PNG"}
          </button>
        </div>
      </div>

      {/* RIGHT — copy-paste text (height matches the card) */}
      <div className="glass glow-edge glass-raise" style={{ flex: "1 1 320px", minWidth: 280, maxWidth: 520, borderRadius: "var(--r-lg)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: ".01em" }}>Copy for X / Telegram</span>
          <button onClick={copy} className="chip" style={{ padding: "6px 12px", fontSize: 12 }}>{copied ? "✓ Copied" : "Copy"}</button>
        </div>
        <textarea
          readOnly value={text} spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
          style={{ width: "100%", flex: 1, minHeight: 340, resize: "none", background: "rgba(0,0,0,0.28)", border: `1px solid ${HAIR}`, borderRadius: 8, color: "var(--ink)", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.65, padding: "12px 13px" }}
        />
      </div>
    </div>
  );
}

function KpiBlock({ heading, kpis }: { heading: string; kpis: Kpi[] }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${HAIR}`, borderRadius: 8, padding: "12px 13px" }}>
      <div style={{ fontSize: 9.5, color: MUT, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>{heading}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
            <span style={{ fontSize: 11, color: MUT, whiteSpace: "nowrap" }}>{k.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", textAlign: "right", color: k.tone === "pos" ? POS : k.tone === "neg" ? NEG : INK }}>
              {k.value}
              {k.delta && <span style={{ fontSize: 10, color: k.delta.startsWith("−") ? NEG : POS, marginLeft: 5 }}>{k.delta}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
