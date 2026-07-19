import { ImageResponse } from "next/og";

// Static OG/Twitter card image for RiseScreener — 1200×630
export const runtime = "edge";
export const alt = "RiseScreener — RISE Chain & RISEx analytics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#34cfa2";
const ACCENT_2 = "#7d93c8";
const INK = "#e8f2ee";
const MUTED = "#8ca3a0";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(1100px 620px at 82% -10%, rgba(52,207,162,0.16), rgba(7,14,12,0) 60%), radial-gradient(900px 520px at 0% 120%, rgba(125,147,200,0.14), rgba(7,14,12,0) 55%), #070e0c",
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              width: 84,
              height: 84,
              borderRadius: 22,
              background: "#0a1512",
              border: "1px solid rgba(52,207,162,0.35)",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 8,
              padding: "0 16px 18px",
            }}
          >
            <div style={{ display: "flex", width: 12, height: 20, borderRadius: 3, background: ACCENT }} />
            <div style={{ display: "flex", width: 12, height: 32, borderRadius: 3, background: ACCENT }} />
            <div style={{ display: "flex", width: 12, height: 44, borderRadius: 3, background: ACCENT }} />
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>
            <span style={{ color: ACCENT }}>RISE</span>
            <span style={{ color: INK }}>SCREENER</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>
            RISE Chain &amp; RISEx
          </div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1, color: ACCENT }}>
            perps analytics &amp; risk screener
          </div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 8 }}>
            Live markets · open interest · funding · fees · liquidations · flows
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, color: MUTED }}>risescreener.com</div>
          <div style={{ display: "flex", fontSize: 22, color: ACCENT_2 }}>Unofficial · read-only analytics</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
