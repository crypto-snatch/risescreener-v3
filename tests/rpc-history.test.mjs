import test from "node:test";
import assert from "node:assert/strict";
import {aggregateDay,TOPICS} from "../scripts/lib/rpc-history.mjs";
import {mergeRpcHistory} from "../scripts/lib/merge-rpc-history.mjs";
const DAY=86_400_000,start=Date.parse("2026-10-27T00:00:00Z");
const hex=n=>`0x${n.toString(16)}`;
const data=values=>"0x"+values.map(n=>((n+(1n<<256n))%(1n<<256n)).toString(16).padStart(64,"0")).join("");
test("RPC decoder preserves signed maker rebates and counts taker volume once",()=>{
  const take={topics:[TOPICS.take,hex(36n),hex((123n<<2n)+1n)],blockTimestamp:hex(BigInt(start/1000)),data:data([1234n,2n*10n**18n,10n**17n,2n*10n**16n,0n])};
  const maker={...take,topics:[TOPICS.maker,hex(36n),hex((123n<<1n)+1n)],data:data([1234n,2n*10n**18n,-5n*10n**16n,0n,1n])};
  const entry=aggregateDay([take,maker],new Map([[36,{symbol:"NVDA",stepPrice:10n**16n}]]),start,start+DAY);
  assert.equal(entry.volume,24.68);assert.equal(entry.trades,1);assert.equal(entry.activeUserIds,1);
  assert.equal(entry.maker,-0.05);assert.equal(entry.taker,0.1);assert.equal(entry.liq,0.02);
  assert.equal(entry.markets.NVDA.volume,24.68);
});
test("unexpected event layouts fail before publishing misleading totals",()=>{
  assert.throws(()=>aggregateDay([{topics:[TOPICS.take,hex(1n),hex(8n)],blockTimestamp:hex(BigInt(start/1000)),data:"0x"}],
    new Map([[1,{symbol:"BTC",stepPrice:1n}]]),start,start+DAY),/Unexpected event layout/);
});
function seed(){return {protocol:[{t:start}],volume:[],feesByMarket:[],liqFeesByMarket:[],
  totals:{cumVolume:100,cumTrades:1,cumFees:10,cumVolumeCmd:0,cumVolumeStk:0,cumVolumeRwa:0,cumVolumeCrypto:100},
  fees:{total:10,taker:10,maker:0,liq:0}};}
const directory={markets:{NVDA:{assetClass:"Stocks"}}};
const day=t=>({t,volume:20,taker:2,maker:-0.5,liq:0.2,trades:2,activeUserIds:3,
  markets:{NVDA:{volume:20,taker:2,maker:-0.5,liq:0.2,trades:2}}});
test("repeated checkpoints and refreshed seed overlaps do not double-count history",()=>{
  const history={days:[day(start),day(start+DAY)]};
  const merged=mergeRpcHistory(seed(),history,directory,start+3*DAY);
  assert.equal(merged.totals.cumVolume,120);assert.equal(merged.totals.cumFees,11.7);
  assert.equal(merged.totals.cumVolumeStk,20);assert.equal(merged.protocol.at(-1).activeTraders,3);
  assert.deepEqual(mergeRpcHistory(merged,history,directory,start+3*DAY),merged);
});
test("missing days and partial current UTC days cannot inflate cumulative totals",()=>{
  assert.equal(mergeRpcHistory(seed(),{days:[day(start+2*DAY)]},directory,start+3*DAY).totals.cumVolume,100);
  assert.equal(mergeRpcHistory(seed(),{days:[day(start+DAY)]},directory,start+DAY).totals.cumVolume,100);
});
import {aggregateCollateral,COLLATERAL_TOPICS,USDC_TOPIC} from "../scripts/lib/rpc-history.mjs";
const flow=(topic,amount,token=USDC_TOPIC,at=start)=>({topics:[topic,hex(1n),hex(2n),token],blockTimestamp:hex(BigInt(at/1000)),data:data([amount])});
test("collateral flows sum USDC deposits and withdrawals inside the UTC day only",()=>{
  const logs=[flow(COLLATERAL_TOPICS.deposit,1_500_000n),flow(COLLATERAL_TOPICS.deposit,250_000n),
    flow(COLLATERAL_TOPICS.withdraw,400_000n),flow(COLLATERAL_TOPICS.deposit,9_000_000n,USDC_TOPIC,start+DAY)];
  assert.deepEqual(aggregateCollateral(logs,start,start+DAY),{deposits:1.75,withdrawals:0.4});
  assert.throws(()=>aggregateCollateral([flow(COLLATERAL_TOPICS.deposit,1n,hex(7n))],start,start+DAY),/Unexpected collateral token/);
});
test("highest account id is recorded with the day's active traders",()=>{
  const take=id=>({topics:[TOPICS.take,hex(36n),hex((BigInt(id)<<2n)+1n)],blockTimestamp:hex(BigInt(start/1000)),data:data([1234n,10n**18n,0n,0n,0n])});
  const entry=aggregateDay([take(41),take(907),take(41)],new Map([[36,{symbol:"NVDA",stepPrice:10n**16n}]]),start,start+DAY);
  assert.equal(entry.activeUserIds,2);assert.equal(entry.maxUserId,907);
});
function flowSeed(){return {...seed(),tvl:[{t:start,tvl:1000,deposits:10,withdrawals:0,net:10}],
  accounts:[{t:start,newAccounts:5,activeTraders:9,cumAccounts:500}],
  totals:{...seed().totals,tvl:1000,accounts:500}};}
test("TVL and accounts extend only across contiguous days that carry their fields",()=>{
  const full=t=>({...day(t),deposits:70,withdrawals:20,maxUserId:520});
  const history={days:[full(start+DAY),{...full(start+2*DAY),maxUserId:515},day(start+3*DAY),full(start+4*DAY)]};
  const merged=mergeRpcHistory(flowSeed(),history,directory,start+6*DAY);
  // day 3 has no flow/id fields, so both series stop there even though day 4 is complete
  assert.equal(merged.tvl.length,3);assert.equal(merged.totals.tvl,1100);assert.equal(merged.tvl.at(-1).net,50);
  assert.equal(merged.accounts.length,3);assert.equal(merged.totals.accounts,520);
  // a lower sampled id never makes the cumulative count go backwards
  assert.equal(merged.accounts.at(-1).newAccounts,0);assert.equal(merged.accounts.at(-2).newAccounts,20);
  assert.equal(merged.totals.cumVolume,180); // volume history is unaffected by the missing fields
  assert.deepEqual(mergeRpcHistory(merged,history,directory,start+6*DAY),merged);
});
