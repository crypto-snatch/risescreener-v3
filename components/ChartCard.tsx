"use client";

import { useRef, useState, type ReactNode } from "react";
import { toPng, toBlob } from "html-to-image";

export type LegendItem = { name: string; color: string; value?: string; pct?: number };

// Reusable chart frame: hover activation, per-chart capture → enlarge modal
// with Copy-to-Clipboard / Download, an optional controls row, and legend.
// Charts passed as children should use height="100%" so they fill the frame
// (inline and enlarged in the modal).
export default function ChartCard({
  title,
  height = 300,
  legend,
  filename = "risescreener-chart",
  toolbar,
  controls,
  children,
}: {
  title: string;
  height?: number;
  legend?: LegendItem[];
  filename?: string;
  toolbar?: ReactNode; // header-right extra controls
  controls?: ReactNode; // row between header and chart (e.g. legend toggles)
  children: ReactNode; // chart, should fill height="100%"
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const shot = useRef<HTMLDivElement>(null);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 1600); };
  const grab = async (kind: "copy" | "download") => {
    if (!shot.current) return;
    const opts = { pixelRatio: 2, cacheBust: true, backgroundColor: "#0a1411" } as const;
    try {
      if (kind === "download") {
        const url = await toPng(shot.current, opts);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.png`;
        a.click();
        flash("Saved");
      } else {
        const blob = await toBlob(shot.current, opts);
        if (blob && typeof ClipboardItem !== "undefined") {
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
          flash("Copied");
        } else flash("Not supported");
      }
    } catch {
      flash("Failed");
    }
  };

  const Legend = legend?.length ? (
    <div className="chart-legend">
      {legend.map((l) => (
        <span key={l.name} className="chart-legend-item">
          <span className="sw" style={{ background: l.color }} />
          <span className="nm">{l.name}</span>
          {l.value != null && <span className="vl tnum">{l.value}</span>}
          {l.pct != null && <span className="pc tnum">{l.pct.toFixed(1)}%</span>}
        </span>
      ))}
    </div>
  ) : null;

  const Camera = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );

  return (
    <>
      <div className="glass glow-edge glass-raise chartcard" style={{ borderRadius: "var(--r-lg)", padding: "14px 16px", display: "flex", flexDirection: "column", height: "100%" }}>
        <header className="chartcard-head">
          <span className="chartcard-title">{title}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {toolbar}
            <button className="cap-btn" title="Capture chart" aria-label="Capture chart" onClick={() => setOpen(true)}>{Camera}</button>
          </div>
        </header>
        {controls}
        <div style={{ height, flex: "1 1 auto", minHeight: height }}>{children}</div>
        {Legend}
      </div>

      {open && (
        <div className="cap-overlay" onClick={() => setOpen(false)}>
          <div className="cap-modal glass glass-raise" onClick={(e) => e.stopPropagation()}>
            <button className="cap-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            <div ref={shot} className="cap-shot">
              <div className="cap-shot-title">{title}</div>
              {controls}
              <div style={{ height: 440 }}>{children}</div>
              {Legend}
              <div className="cap-brand"><span className="text-accent wm">RiseScreener</span> · RISEx analytics</div>
            </div>
            <div className="cap-actions">
              {msg && <span className="cap-msg">{msg}</span>}
              <button className="chip" onClick={() => grab("copy")}>⧉ Copy to Clipboard</button>
              <button className="chip tag-accent" onClick={() => grab("download")}>↓ Download</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
