// Market sector classification for RISEx perps.
export const SECTORS: Record<string, string[]> = {
  "Layer 1": ["BTC", "ETH", "SOL", "ZEC", "BNB", "NEAR", "XRP"],
  DeFi: ["HYPE", "AERO", "ONDO", "LIT"],
  AI: ["TAO", "VVV"],
  MEME: ["DOGE"],
};

export const CAT_COLOR: Record<string, string> = {
  "Layer 1": "#7d93c8",
  DeFi: "#34cfa2",
  AI: "#c79bff",
  MEME: "#e6c069",
};

export const SECTOR_NAMES = Object.keys(SECTORS);
export const categoryOf = (sym: string): string => SECTOR_NAMES.find((s) => SECTORS[s].includes(sym)) ?? "Other";
