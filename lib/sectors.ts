// Market sector classification for RISEx perps.
export const SECTORS: Record<string, string[]> = {
  "Layer 1": ["BTC", "ETH", "SOL", "ZEC", "BNB", "NEAR", "XRP"],
  DeFi: ["HYPE", "AERO", "ONDO", "LIT", "AAVE", "PUMP"], // PUMP = pump.fun launchpad token (app/revenue token, like HYPE/AERO)
  Commodities: ["XAU", "XAG", "CL", "BZ"], // metals (gold, silver) + crude oil (WTI, Brent)
  Stocks: ["SNDK", "SPCX", "MU", "DRAM", "INTC", "QQQ", "SPY"], // equities/ETFs — SanDisk, SpaceX, Micron, Roundhill Memory ETF, Intel, Nasdaq-100, S&P 500
  AI: ["TAO", "VVV"],
  MEME: ["DOGE"],
};

export const CAT_COLOR: Record<string, string> = {
  "Layer 1": "#7d93c8",
  DeFi: "#34cfa2",
  Commodities: "#e6c069", // gold — matches CLASS_COLOR.Commodities
  Stocks: "#5fa8ff", // azure — matches CLASS_COLOR.Stocks
  AI: "#c79bff",
  MEME: "#e879a6", // moved off gold so it doesn't collide with Commodities
};

export const SECTOR_NAMES = Object.keys(SECTORS);
export const categoryOf = (sym: string): string => SECTOR_NAMES.find((s) => SECTORS[s].includes(sym)) ?? "Other";

// ── asset class: crypto vs real-world assets ──
// RWA perps on RISEx split into two classes: Commodities — gold (XAU), silver
// (XAG), WTI (CL), Brent (BZ) — and Stocks — SanDisk (SNDK), SpaceX (SPCX),
// Micron (MU), Intel (INTC), the Roundhill Memory ETF (DRAM, an equity ETF
// despite the commodity-sounding ticker) and the two index ETFs QQQ (Nasdaq-100)
// and SPY (S&P 500). "RWA" remains the umbrella for both.
export const CMD_SYMBOLS = SECTORS.Commodities;
export const STOCK_SYMBOLS = SECTORS.Stocks;
export const RWA_SYMBOLS = [...CMD_SYMBOLS, ...STOCK_SYMBOLS]; // umbrella (commodities + stocks)
export const RWA_NAMES: Record<string, string> = {
  XAU: "Gold", XAG: "Silver", CL: "WTI Crude", BZ: "Brent Crude",
  SNDK: "SanDisk", SPCX: "SpaceX", MU: "Micron", DRAM: "Memory ETF",
  INTC: "Intel", QQQ: "Nasdaq-100 ETF", SPY: "S&P 500 ETF",
};
export type AssetClass = "Crypto" | "Commodities" | "Stocks";
export const isCommodity = (sym: string): boolean => CMD_SYMBOLS.includes(sym);
export const isStock = (sym: string): boolean => STOCK_SYMBOLS.includes(sym);
export const isRwa = (sym: string): boolean => RWA_SYMBOLS.includes(sym);
export const assetClassOf = (sym: string): AssetClass => (isCommodity(sym) ? "Commodities" : isStock(sym) ? "Stocks" : "Crypto");
// class accent + per-market tints for individual RWA markets in per-market charts
// (metals stay in the gold family; oil gets amber/bronze; stocks get their own
// cool-toned tints under the azure Stocks accent).
export const CLASS_COLOR: Record<AssetClass, string> = { Crypto: "#34cfa2", Commodities: "#e6c069", Stocks: "#5fa8ff" };
export const RWA_COLORS: Record<string, string> = {
  XAU: "#e6c069", XAG: "#c9d1d9", CL: "#d98a4a", BZ: "#b06b3a",
  SNDK: "#e0685f", SPCX: "#7ea6e0", MU: "#4fb3c9", DRAM: "#9d8ce0",
  INTC: "#6fb98f", QQQ: "#b8c95f", SPY: "#d98cb3",
};
