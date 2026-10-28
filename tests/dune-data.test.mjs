import test from "node:test";
import assert from "node:assert/strict";
import { buildDuneData, utcTime } from "../scripts/lib/dune-data.mjs";
import { readFile } from "node:fs/promises";
const now=Date.parse("2026-10-28T14:00:00Z");
const catalog={markets:{BTC:{assetClass:"Crypto"},NVDA:{assetClass:"Stocks"},XAU:{assetClass:"Commodities"}}};
function fixture() {
  return {
    volumeByMarket:{rows:[{period:"2026-10-27 00:00:00",market_name:"BTC/USDC",daily_volume_usd:100,daily_taker_fees_usd:10,daily_total_fees_usd:13,daily_liquidation_fees_usd:3},
      {period:"2026-10-27 00:00:00",market_name:"NVDA/USDC",daily_volume_usd:40,daily_taker_fees_usd:4},
      {period:"2026-10-28 00:00:00",market_name:"BTC/USDC",daily_volume_usd:999}]},
    protocolDaily:{rows:[{day:"2026-10-27",cumulative_volume_usd:140,cumulative_taker_fees_usd:14,cumulative_maker_fees_usd:-2,cumulative_liquidation_fees_usd:3,
      daily_taker_fees_usd:14,daily_maker_fees_usd:-2,daily_liquidation_fees_usd:3},
      {day:"2026-10-28",cumulative_volume_usd:9999}]},
    accountsDaily:{rows:[{period:"2026-10-27 00:00:00",cumulative_accounts:24,active_traders:3}]},
    tvlDaily:{rows:[{day:"2026-10-27",cumulative_tvl:50}]},
    oiNow:{rows:[{market_name:"BTC/USDC",oi_usd:80,total_oi_usd:80}]},liqTotals:{rows:[{alltime_liquidation_fees_usd:3}]},
  };
}
test("UTC dates accept date-only, Dune timestamps, and ISO without duplicating Z",()=>{
  for(const date of ["2026-10-27","2026-10-27 00:00:00","2026-10-27T00:00:00Z"])
    assert.equal(utcTime(date),Date.parse("2026-10-27T00:00:00Z"));
  assert.ok(Number.isNaN(utcTime("invalid")));
});
test("liquidation fees are counted exactly once, and maker rebates stay signed",()=>{
  const d=buildDuneData(fixture(),catalog,now);
  assert.equal(d.feesByMarket[0].BTC,10);assert.equal(d.liqFeesByMarket[0].BTC,3);
  assert.equal(d.totals.cumFees,15);assert.equal(d.fees.maker,-2);assert.equal(d.fees.total,12);
});
test("new stock listings enter the stock/RWA totals without double counting",()=>{
  const d=buildDuneData(fixture(),catalog,now);
  assert.equal(d.volume[0].NVDA,40);assert.equal(d.volume[0].Stocks,40);assert.equal(d.volume[0].RWA,40);
  assert.equal(d.volume[0].Others,0);assert.equal(d.totals.cumVolumeStk,40);
});
test("partial current-day data does not enter daily history or cumulative cards",()=>{
  const d=buildDuneData(fixture(),catalog,now);
  assert.equal(d.volume.length,1);assert.equal(d.protocol.length,1);assert.equal(d.totals.cumVolume,140);
});
test("missing source results cannot replace a valid stored snapshot",()=>{
  const r=fixture();r.accountsDaily.rows=[];
  assert.throws(()=>buildDuneData(r,catalog,now),/Incomplete/);
});
test("every current market has a real local SVG and an explicit asset class",async()=>{
  const root=new URL("../",import.meta.url);
  const directory=JSON.parse(await readFile(new URL("data/market-catalog.json",root),"utf8"));
  for(const [symbol,market] of Object.entries(directory.markets)) {
    const svg=await readFile(new URL(`public${market.logo}`,root),"utf8");
    assert.match(svg,/<svg/);assert.ok(["Crypto","Stocks","Commodities"].includes(market.assetClass),symbol);
  }
});
