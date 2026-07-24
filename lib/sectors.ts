// Market sector classification for RISEx perps.
export const SECTORS: Record<string, string[]> = {
  "Layer 1": ["BTC", "ETH", "SOL", "ZEC", "BNB", "NEAR", "XRP"],
  DeFi: ["HYPE", "AERO", "ONDO", "LIT", "AAVE"],
  RWA: ["XAU", "XAG", "CL", "BZ"], // real-world assets — metals (gold, silver) + crude oil (WTI, Brent)
  AI: ["TAO", "VVV"],
  MEME: ["DOGE"],
};

export const CAT_COLOR: Record<string, string> = {
  "Layer 1": "#7d93c8",
  DeFi: "#34cfa2",
  RWA: "#e6c069", // gold — matches CLASS_COLOR.RWA
  AI: "#c79bff",
  MEME: "#e879a6", // moved off gold so it doesn't collide with RWA
};

export const SECTOR_NAMES = Object.keys(SECTORS);
export const categoryOf = (sym: string): string => SECTOR_NAMES.find((s) => SECTORS[s].includes(sym)) ?? "Other";

// ── asset class: crypto vs real-world assets ──
// RWA perps on RISEx are the metals — gold (XAU), silver (XAG) — plus crude oil:
// WTI (CL) and Brent (BZ).
export const RWA_SYMBOLS = SECTORS.RWA; // single source of truth (metals + oil)
export const RWA_NAMES: Record<string, string> = { XAU: "Gold", XAG: "Silver", CL: "WTI Crude", BZ: "Brent Crude" };
export type AssetClass = "Crypto" | "RWA";
export const isRwa = (sym: string): boolean => RWA_SYMBOLS.includes(sym);
export const assetClassOf = (sym: string): AssetClass => (isRwa(sym) ? "RWA" : "Crypto");
// class accent + per-market tints for individual RWA markets in per-market charts
// (metals stay in the gold family; oil gets its own amber/bronze tones).
export const CLASS_COLOR: Record<AssetClass, string> = { Crypto: "#34cfa2", RWA: "#e6c069" };
export const RWA_COLORS: Record<string, string> = { XAU: "#e6c069", XAG: "#c9d1d9", CL: "#d98a4a", BZ: "#b06b3a" };
