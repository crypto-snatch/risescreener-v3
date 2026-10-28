import catalog from "@/data/market-catalog.json";

export type CatalogMarket = { id: string; name: string; assetClass: string; sector: string; logo: string; iconSource: string };
export const MARKET_CATALOG: Record<string, CatalogMarket> = catalog.markets;
export const marketSymbol = (symbol: string) => symbol.toUpperCase().split("/")[0].trim();
export const marketInfo = (symbol: string) => MARKET_CATALOG[marketSymbol(symbol)];
