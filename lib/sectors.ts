// Market sector classification for RISEx perps.
export const SECTORS: Record<string, string[]> = {
  "Layer 1": ["BTC", "ETH", "SOL", "ZEC", "BNB", "NEAR", "XRP"],
  DeFi: ["HYPE", "AERO", "ONDO", "LIT", "AAVE"],
  RWA: ["XAU", "XAG"], // real-world assets — gold & silver
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
// RWA perps on RISEx are the metals — gold (XAU) and silver (XAG).
export const RWA_SYMBOLS = SECTORS.RWA; // single source of truth (gold, silver)
export const RWA_NAMES: Record<string, string> = { XAU: "Gold", XAG: "Silver" };
export type AssetClass = "Crypto" | "RWA";
export const isRwa = (sym: string): boolean => RWA_SYMBOLS.includes(sym);
export const assetClassOf = (sym: string): AssetClass => (isRwa(sym) ? "RWA" : "Crypto");
// class accent + gold-family tints for individual RWA markets in per-market charts
export const CLASS_COLOR: Record<AssetClass, string> = { Crypto: "#34cfa2", RWA: "#e6c069" };
export const RWA_COLORS: Record<string, string> = { XAU: "#e6c069", XAG: "#c9d1d9" };
