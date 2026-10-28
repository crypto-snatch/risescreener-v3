// Free, keyless incremental history from RISE's public RPC. No SQL/API credits.
// A checkpoint is committed only after a complete UTC day has been read successfully.
// --verify-day YYYY-MM-DD compares independently with the stored Dune source and writes no history.
import {readFile,writeFile,rename} from "node:fs/promises";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {TOPICS,configEvent,aggregateDay} from "./lib/rpc-history.mjs";
const ROOT=join(dirname(fileURLToPath(import.meta.url)),"..");
const RPC=process.env.RISE_RPC_URL || "https://rpc.risechain.com";
const CONTRACT="0x53f10fAcFC8965750494E6965F5d6dA39B41d852";
const OUT=join(ROOT,"data","rpc-history.json"),DAY=86_400_000;
let requests=0;
async function rpc(method,params) {
  for(let attempt=0;attempt<4;attempt++) {
    try {
      const response=await fetch(RPC,{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({jsonrpc:"2.0",id:++requests,method,params}),signal:AbortSignal.timeout(30_000)});
      if(!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const result=await response.json();
      if(result.error) throw new Error(`RPC ${result.error.message}`);
      if(result.result==null) throw new Error("RPC response is incomplete");
      return result.result;
    } catch(error) {
      if(/max (?:results|block range)/i.test(error.message)) throw error;
      if(attempt===3) throw error;
      await new Promise(r=>setTimeout(r,500*(attempt+1)));
    }
  }
}
const hex=n=>`0x${n.toString(16)}`;
const block=async n=>rpc("eth_getBlockByNumber",[hex(n),false]);
async function firstBlockAt(timestamp,head) {
  let lo=0,hi=head;
  while(lo<hi) {const mid=Math.floor((lo+hi)/2);const b=await block(mid);
    if(Number(BigInt(b.timestamp))*1000<timestamp) lo=mid+1;else hi=mid;}
  return lo;
}
async function getLogs(from,to,topics) {
  let result=[];
  async function range(a,b) {
    try {return await rpc("eth_getLogs",[{address:CONTRACT,fromBlock:hex(a),toBlock:hex(b),topics:[topics]}]);}
    catch(error) {
      if(!/max results/i.test(error.message) || a===b) throw error;
      const mid=Math.floor((a+b)/2);
      return [...await range(a,mid),...await range(mid+1,b)];
    }
  }
  for(let start=from;start<=to;start+=4000) {
    const logs=await range(start,Math.min(to,start+3999));
    // RISE includes blockTimestamp in log responses. Fail closed if that changes.
    if(!Array.isArray(logs) || logs.some(l=>!l.blockTimestamp || l.removed)) throw new Error("RPC returned incomplete/reorged logs");
    result.push(...logs);
    if((start-from)%20000===0) console.log(`  blocks ${start}–${Math.min(to,start+3999)} · ${result.length} relevant logs`);
  }
  return result;
}
try {
  const verifyIndex=process.argv.indexOf("--verify-day");
  const verify=verifyIndex>=0 ? Date.parse(`${process.argv[verifyIndex+1]}T00:00:00Z`) : null;
  if(verifyIndex>=0 && !Number.isFinite(verify)) throw new Error("Invalid --verify-day date");
  const base=JSON.parse(await readFile(join(ROOT,"data","dune.json"),"utf8"));
  const baseThrough=base.protocol?.at(-1)?.t;
  if(!baseThrough) throw new Error("A complete historical seed is required");
  let history={source:RPC,contract:CONTRACT,seedThrough:baseThrough,days:[]};
  try {history=JSON.parse(await readFile(OUT,"utf8"));} catch {}
  const today=Math.floor(Date.now()/DAY)*DAY;
  let start=verify ?? Math.max(baseThrough,history.days.at(-1)?.t ?? 0)+DAY;
  const last=verify ?? today-DAY;
  if(last>=today) throw new Error("Only complete UTC days can be recorded");
  if(start>last) {console.log("Keyless history is current through the latest complete UTC day");process.exit(0);}
  // Bounded catch-up prevents a cron from accidentally scanning months on public RPC.
  const stop=Math.min(last,start+2*DAY);
  const head=Number(BigInt(await rpc("eth_blockNumber",[])))-60;
  const headBlock=await block(head);
  if(Number(BigInt(headBlock.timestamp))*1000<stop+DAY) throw new Error("RPC head has not covered the requested complete day");
  const marketsResponse=await fetch("https://api.rise.trade/v1/markets",{signal:AbortSignal.timeout(20_000)});
  if(!marketsResponse.ok) throw new Error("RISEx market config unavailable");
  const markets=(await marketsResponse.json()).data?.markets;
  if(!Array.isArray(markets) || !markets.length) throw new Error("Empty market config");
  const initial=new Map(markets.map(m=>[Number(m.market_id),{symbol:m.config.name.split("/")[0],
    stepPrice:(()=>{const [whole,fraction=""]=String(m.config.step_price).split(".");
      if(!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length>18) throw new Error("Invalid price step");
      return BigInt(whole)*10n**18n+BigInt(fraction.padEnd(18,"0"));})()}]));
  const from=await firstBlockAt(start,head),to=await firstBlockAt(stop+DAY,head)-1;
  const logs=await getLogs(from,to,Object.values(TOPICS));
  // Roll back current configs to the start of the requested range, then replay forward.
  const configHead=Number(BigInt(await rpc("eth_blockNumber",[])));
  const later=await getLogs(to+1,configHead,[TOPICS.open,TOPICS.config]);
  const configs=[...logs,...later].filter(l=>[TOPICS.open,TOPICS.config].includes(l.topics[0]));
  for(const log of configs.reverse()) {const event=configEvent(log);
    if(event.previous) initial.set(event.id,event.previous);else initial.delete(event.id);}
  logs.sort((a,b)=>Number(BigInt(a.blockNumber)-BigInt(b.blockNumber)) || Number(BigInt(a.logIndex)-BigInt(b.logIndex)));
  for(let day=start;day<=stop;day+=DAY) {
    const entry=aggregateDay(logs,initial,day,day+DAY);
    if(entry.trades===0) throw new Error("No trades in a complete day; refusing to publish an unverified zero");
    console.log(`${new Date(day).toISOString().slice(0,10)}: volume $${entry.volume.toFixed(2)}, fees $${(entry.taker+entry.maker+entry.liq).toFixed(4)}, ${entry.trades} taker events`);
    if(verify!=null) {
      const expected=base.protocol.find(d=>d.t===day);
      if(!expected) throw new Error("No independent daily reference available");
      for(const key of ["volume","taker","maker","liq","trades"]) {
        const tolerance=key==="trades" ? 0 : Math.max(0.01,Math.abs(expected[key])*1e-8);
        if(Math.abs(entry[key]-expected[key])>tolerance) throw new Error(`Independent ${key} mismatch: RPC=${entry[key]}, Dune=${expected[key]}`);
      }
      console.log("PASS: volume, taker fees, maker rebates, liquidation fees and event counts agree with Dune");
    } else {
      history.days=history.days.filter(d=>d.t!==day).concat(entry).sort((a,b)=>a.t-b.t);
    }
  }
  if(verify==null) {
    history.generatedAt=new Date().toISOString();history.throughBlock=to;
    await writeFile(`${OUT}.tmp`,JSON.stringify(history));await rename(`${OUT}.tmp`,OUT);
  }
  console.log(`RPC calls: ${requests}. No Dune key used.`);
} catch(error) {console.error(`Keyless history failed; prior data preserved. ${error.message}`);process.exitCode=1;}
