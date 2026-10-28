// Refresh the market directory and cache the same icons used by RISEx.
// No ticker-based third-party lookup: stock/commodity symbols can collide with coins.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "market-catalog.json");
const ICONS = join(ROOT, "public", "market-icons");
const NAMES = {
  BTC: "Bitcoin", ETH: "Ethereum", BNB: "BNB", SOL: "Solana", HYPE: "Hyperliquid", XRP: "XRP",
  TAO: "Bittensor", ZEC: "Zcash", ONDO: "Ondo", NEAR: "NEAR Protocol", VVV: "Venice AI",
  LIT: "Lighter", DOGE: "Dogecoin", AERO: "Aerodrome", AAVE: "Aave", PUMP: "Pump.fun",
  XAU: "Gold", XAG: "Silver", CL: "WTI Crude Oil", BZ: "Brent Crude Oil", SNDK: "SanDisk",
  SPCX: "SpaceX", DRAM: "Memory ETF", MU: "Micron", QQQ: "Nasdaq-100 ETF", SPY: "S&P 500 ETF",
  INTC: "Intel", MSTR: "Strategy", KORU: "South Korea 3x ETF", CRCL: "Circle", TSLA: "Tesla",
  ARB: "Arbitrum", HOOD: "Robinhood", SKHYNIX: "SK hynix", NVDA: "NVIDIA", META: "Meta",
  ENA: "Ethena", SOXL: "Semiconductor Bull 3x ETF", MON: "Monad", WLD: "Worldcoin",
  GOOGL: "Alphabet", STRK: "Starknet", ZRO: "LayerZero", CRWV: "CoreWeave", XMR: "Monero",
  EWZ: "MSCI Brazil ETF", LLY: "Eli Lilly", CHIP: "USD.AI",
};
const GROUPS = {
  "Layer 1": ["BTC", "ETH", "BNB", "SOL", "XRP", "ZEC", "NEAR", "MON", "XMR"],
  "Layer 2": ["ARB", "STRK"],
  DeFi: ["HYPE", "ONDO", "LIT", "AERO", "AAVE", "PUMP", "ENA", "CHIP"],
  AI: ["TAO", "VVV", "WLD"], MEME: ["DOGE"], Infrastructure: ["ZRO"],
};
const digest = (data) => createHash("sha256").update(data).digest("hex");
const fetchOk = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r;
};
const api = await (await fetchOk("https://api.rise.trade/v1/markets")).json();
const live = (api.data?.markets ?? []).filter(m =>
  (m.active ?? m.available) && /\/USDC$/.test(m.config?.name ?? ""));
if (!live.length) throw new Error("RISEx returned no visible markets; directory left unchanged");
let previous = { markets: {} };
try { previous = JSON.parse(await readFile(OUT, "utf8")); } catch {}
await mkdir(ICONS, { recursive: true });
const unknown = digest(Buffer.from(await (await fetchOk("https://www.rise.trade/crypto-icons/unknown.svg")).arrayBuffer()));
const markets = {};
for (let i = 0; i < live.length; i += 6) {
  await Promise.all(live.slice(i, i + 6).map(async m => {
    const symbol = m.config.name.split("/")[0];
    if (!/^[A-Z0-9]+$/.test(symbol)) throw new Error(`Unexpected market symbol ${symbol}`);
    const source = `https://www.rise.trade/crypto-icons/${symbol.toLowerCase()}.svg`;
    let path = `/market-icons/${symbol.toLowerCase()}-risex.svg`;
    const target = join(ROOT, "public", path);
    try {
      const icon = Buffer.from(await (await fetchOk(source)).arrayBuffer());
      if (!icon.toString("utf8").includes("<svg") || digest(icon) === unknown) throw new Error("Missing official SVG");
      await writeFile(target, icon);
    } catch (error) {
      // Never replace a real cached icon with the exchange's generic placeholder.
      if (!previous.markets[symbol]?.logo) throw error;
      path = previous.markets[symbol].logo;
    }
    const assetClass = m.category === "commodity" ? "Commodities" :
      ["stocks", "index_etf"].includes(m.category) ? "Stocks" : "Crypto";
    const tags = (m.search_tags ?? []).map(t => String(t).toLowerCase());
    const sector = assetClass !== "Crypto" ? assetClass :
      Object.keys(GROUPS).find(k => GROUPS[k].includes(symbol)) ??
      (tags.includes("layer2") || tags.includes("l2") ? "Layer 2" : tags.includes("ai") ? "AI" :
        tags.includes("defi") ? "DeFi" : tags.includes("meme") ? "MEME" :
          tags.includes("layer1") || tags.includes("l1") ? "Layer 1" : "Other");
    markets[symbol] = { id: String(m.market_id), name: NAMES[symbol] ?? symbol, assetClass, sector,
      logo: path, iconSource: source };
  }));
}
// Preserve delisted assets for historical tables, but mark the current universe explicitly.
const ordered = Object.fromEntries(Object.entries({ ...previous.markets, ...markets })
  .sort((a,b) => Number(a[1].id) - Number(b[1].id)));
const result = { updatedAt: new Date().toISOString(), source: "https://api.rise.trade/v1/markets",
  activeSymbols: live.filter(m => m.config?.unlocked !== false && Number(m.display_at ?? 0) * 1000 <= Date.now())
    .map(m => m.config.name.split("/")[0]), markets: ordered };
await writeFile(`${OUT}.tmp`, JSON.stringify(result, null, 2) + "\n");
await rename(`${OUT}.tmp`, OUT);
console.log(`Market catalog: ${live.length} current markets with official local icons`);
