"use client";

import { useState } from "react";

// The active RISEx universe is deliberately explicit. This prevents symbols such
// as CL, MU or LIT from resolving to an unrelated crypto asset on a ticker-based CDN.
const MARKET_LOGOS: Record<string, string> = {
  BTC: "/market-icons/btc.jpeg",
  ETH: "/market-icons/eth.jpg",
  BNB: "/market-icons/bnb.jpg",
  SOL: "/market-icons/sol.jpg",
  HYPE: "/market-icons/hype.jpg",
  XRP: "/market-icons/xrp.jpg",
  TAO: "/market-icons/tao.jpg",
  ZEC: "/market-icons/zec.jpg",
  NEAR: "/market-icons/near.jpg",
  VVV: "/market-icons/vvv.png",
  LIT: "/market-icons/lit.jpg",
  DOGE: "/market-icons/doge.png",
  AERO: "/market-icons/aero.jpg",
  AAVE: "/market-icons/aave.png",
  XAU: "/market-icons/xau.jpg",
  XAG: "/market-icons/xag.jpg",
  CL: "/market-icons/cl.jpg",
  BZ: "/market-icons/bz.png",
  SNDK: "/market-icons/sndk.png",
  SPCX: "/market-icons/spcx.png",
  PUMP: "/market-icons/pump.jpg",
  DRAM: "/market-icons/dram.jpg",
  MU: "/market-icons/mu.jpg",
  QQQ: "/market-icons/qqq.jpg",
  SPY: "/market-icons/spy.png",
  INTC: "/market-icons/intc.png",
};

const HUES: Record<string, string> = {
  BTC: "#f7931a", ETH: "#718096", BNB: "#f0b90b", SOL: "#14f195", HYPE: "#2ee88e",
  XRP: "#4c6073", TAO: "#9ba5b1", ZEC: "#ecb244", NEAR: "#8d98a6", VVV: "#7d6cff",
  LIT: "#42bdf5", DOGE: "#c2a633", AERO: "#5b8def", AAVE: "#a65bc8", PUMP: "#35d58a",
  XAU: "#d9aa3d", XAG: "#aeb7c3", CL: "#d59c3a", BZ: "#4bb58a", SNDK: "#ef533f",
  SPCX: "#7899ff", DRAM: "#9b6cff", MU: "#3f78d6", QQQ: "#db4168", SPY: "#d9535f", INTC: "#3f8ee8",
};

function FallbackLogo({ symbol, size }: { symbol: string; size: number }) {
  const hue = HUES[symbol] ?? "var(--accent)";
  const mono = symbol.slice(0, symbol.length > 3 ? 2 : 3);
  return (
    <span
      role="img"
      aria-label={`${symbol} market badge`}
      title={symbol}
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        display: "inline-grid",
        placeItems: "center",
        borderRadius: "50%",
        background: `color-mix(in oklab, ${hue} 18%, var(--glass-2))`,
        border: `1px solid color-mix(in oklab, ${hue} 42%, transparent)`,
        color: hue,
        fontSize: Math.max(7, size * 0.31),
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: "-.04em",
        fontFamily: "var(--font-mono)",
      }}
    >
      {mono}
    </span>
  );
}

export default function CoinLogo({ symbol, size = 20 }: { symbol: string; size?: number }) {
  const sym = (symbol || "?").toUpperCase();
  const src = MARKET_LOGOS[sym];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return <FallbackLogo symbol={sym} size={size} />;

  return (
    // Local, curated assets make market rows deterministic and avoid third-party CDN mismatches.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={`${sym} logo`}
      title={sym}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: "50%",
        display: "block",
        objectFit: "contain",
        background: "var(--glass-2)",
      }}
    />
  );
}
