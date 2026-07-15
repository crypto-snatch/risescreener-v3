// Appends one protocol datapoint (with per-coin breakdown) to data/timeseries.json.
// RISEx exposes only current + 24h and no historical API, so the Volume / Open
// Interest history charts are built from these periodic snapshots. Run on a cron.
//   node scripts/snapshot-timeseries.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "timeseries.json");
const API = "https://api.rise.trade";
const BS = "https://explorer.risechain.com/api/v2";
const CM = "0x2C03C7d7e2974C6599b6B108879109281ef3F818";
const GROUPS = ["BTC", "ETH", "SOL", "HYPE"];
const MAX_POINTS = 6000;

const j = async (u) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u);
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((res) => setTimeout(res, 300));
  }
  return null;
};
const sym = (m) => (m.config?.name || m.base_asset_symbol || "").replace("/USDC", "");

async function main() {
  const markets = (await j(`${API}/v1/markets`))?.data?.markets ?? [];
  // "available" was renamed to "active"; accept either so snapshots don't zero out.
  const live = markets.filter((m) => (m.active ?? m.available ?? true) && !/deprecated/i.test(m.config?.name ?? ""));

  const vol = { BTC: 0, ETH: 0, SOL: 0, HYPE: 0, Others: 0 };
  const oi = { BTC: 0, ETH: 0, SOL: 0, HYPE: 0, Others: 0 };
  for (const m of live) {
    const g = GROUPS.includes(sym(m)) ? sym(m) : "Others";
    const mark = Number(m.mark_price) || Number(m.last_price) || 0;
    vol[g] += Number(m.quote_volume_24h) || 0;
    oi[g] += Number(m.open_interest) * mark;
  }
  const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));

  let tvl = 0;
  const tb = await j(`${BS}/addresses/${CM}/token-balances`);
  if (Array.isArray(tb)) {
    const usdc = tb.find((t) => /usd/i.test(t.token?.symbol ?? ""));
    if (usdc) tvl = Number(usdc.value) / Math.pow(10, Number(usdc.token.decimals));
  }
  const w = (await j(`${API}/v1/stats/wallets`))?.data ?? {};

  const point = {
    t: Date.now(),
    vol: round(vol),
    oi: round(oi),
    tvl: Math.round(tvl),
    traders: Number(w.total_traders) || 0,
    realTraders: Number(w.real_wallets) || 0,
  };

  let series = [];
  try {
    const parsed = JSON.parse(await readFile(OUT, "utf8"));
    if (Array.isArray(parsed)) series = parsed;
  } catch {}
  series.push(point);
  if (series.length > MAX_POINTS) series = series.slice(-MAX_POINTS);

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(series));
  const totV = Object.values(point.vol).reduce((a, b) => a + b, 0);
  const totO = Object.values(point.oi).reduce((a, b) => a + b, 0);
  console.log(`✅ point #${series.length} · 24h vol $${(totV / 1e6).toFixed(1)}M · OI $${(totO / 1e6).toFixed(1)}M · TVL $${(point.tvl / 1e6).toFixed(1)}M`);
}

main().catch((e) => {
  console.error("timeseries snapshot failed:", e);
  process.exit(1);
});
