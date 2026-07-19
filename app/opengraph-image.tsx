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

// Green magnifying-glass brand tile (matches app/icon.svg), inlined as a data URI
const MARK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#2EE88E"/><g fill="none" stroke="#0b0f0e" stroke-linecap="round"><circle cx="43" cy="43" r="21" stroke-width="10"/><path d="M59 59 L80 80" stroke-width="12"/></g></svg>'
  );

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#070e0c",
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        {/* Ambient glows (satori-safe radial gradients, no size/position prefix) */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 760,
            height: 560,
            background: "radial-gradient(circle, rgba(52,207,162,0.20), rgba(7,14,12,0) 62%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -180,
            left: -140,
            width: 760,
            height: 560,
            background: "radial-gradient(circle, rgba(125,147,200,0.18), rgba(7,14,12,0) 62%)",
          }}
        />

        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK} width={84} height={84} alt="" style={{ borderRadius: 22 }} />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>
            <span style={{ color: ACCENT }}>RISE</span>
            <span style={{ color: INK }}>SCREENER</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>
            RISE Chain &amp; RISEx
          </div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1, color: ACCENT }}>
            perps analytics &amp; risk screener
          </div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 22 }}>
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
