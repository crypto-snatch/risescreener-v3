// Refresh cached Dune query results, or import a connector export with --from-dir.
// Query execution is opt-in: DUNE_EXECUTE_FRESH=1. Cached reads still need API credits.
import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuneData } from "./lib/dune-data.mjs";

const ROOT=join(dirname(fileURLToPath(import.meta.url)),"..");
const OUT=join(ROOT,"data","dune.json");
const Q={volumeByMarket:6944583,tvlDaily:6940251,protocolDaily:6944629,accountsDaily:6947001,oiNow:6949630,liqTotals:6949906};
const KEY=process.env.DUNE_API_KEY;
const fromIndex=process.argv.indexOf("--from-dir");
const fromDir=fromIndex>=0 ? process.argv[fromIndex+1] : null;
if (fromIndex>=0 && !fromDir) throw new Error("--from-dir requires a directory");

async function api(path,options={}) {
  if (!KEY) throw new Error("Missing DUNE_API_KEY. Configure the GitHub Actions secret or local environment.");
  for(let attempt=0;attempt<3;attempt++) {
    const response=await fetch(`https://api.dune.com/api/v1${path}`,{...options,
      headers:{"X-Dune-Api-Key":KEY,...options.headers},signal:AbortSignal.timeout(30_000)});
    if(response.ok) return response.json();
    if((response.status===429 || response.status>=500) && attempt<2) {
      await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));continue;
    }
    const hint=response.status===402 ? "Dune credits exhausted. Fund the account or replace DUNE_API_KEY with a funded key." :
      [401,403].includes(response.status) ? "DUNE_API_KEY is invalid or lacks access." : "Check Dune availability.";
    throw new Error(`Dune ${response.status}: ${hint}`);
  }
}
async function pages(base) {
  let rows=[],offset=0,execEndedAt=null,executionId=null;
  for(;;) {
    const result=await api(`${base}?limit=1000&offset=${offset}`);
    if(result.is_execution_finished===false) throw new Error("Dune result is still executing");
    execEndedAt ??= result.execution_ended_at ?? null;executionId ??= result.execution_id ?? null;
    const page=result.result?.rows;
    if(!Array.isArray(page)) throw new Error("Dune response is missing result rows");
    rows.push(...page);offset+=page.length;
    if(page.length<1000 || offset>=Number(result.result.metadata?.total_row_count ?? Infinity)) break;
    if(offset>1_000_000) throw new Error("Dune pagination exceeded expected size");
  }
  return {rows,execEndedAt,executionId,retrievedAt:new Date().toISOString()};
}
async function query(queryId) {
  const cached=await pages(`/query/${queryId}/results`);
  const today=Math.floor(Date.now()/86_400_000)*86_400_000;
  if(process.env.DUNE_EXECUTE_FRESH!=="1" || Date.parse(cached.execEndedAt ?? "")>=today) return {...cached,queryId};
  const {execution_id}=await api(`/query/${queryId}/execute`,{method:"POST"});
  const deadline=Date.now()+240_000;
  while(Date.now()<deadline) {
    await new Promise(resolve=>setTimeout(resolve,5000));
    const state=await api(`/execution/${execution_id}/status`);
    if(state.state==="QUERY_STATE_COMPLETED") return {...await pages(`/execution/${execution_id}/results`),queryId};
    if(["QUERY_STATE_FAILED","QUERY_STATE_CANCELLED","QUERY_STATE_EXPIRED"].includes(state.state)) throw new Error(state.state);
  }
  throw new Error("Dune query execution timed out");
}
try {
  const results={};
  for(const [name,id] of Object.entries(Q)) {
    results[name]=fromDir ? {...JSON.parse(await readFile(join(fromDir,`dune-${id}.json`),"utf8")),queryId:id} : await query(id);
  }
  const catalog=JSON.parse(await readFile(join(ROOT,"data","market-catalog.json"),"utf8"));
  const data=buildDuneData(results,catalog);
  const lastDay=data.volume.at(-1).t;
  if(Date.now()-lastDay>3*86_400_000) throw new Error(`Dune history is stale through ${new Date(lastDay).toISOString()}; previous snapshot preserved`);
  await writeFile(`${OUT}.tmp`,JSON.stringify(data));await rename(`${OUT}.tmp`,OUT);
  console.log(`Dune refreshed: ${data.volume.length} complete UTC days, ${data.totals.accounts} accounts, fees $${Math.round(data.totals.cumFees)}`);
} catch(error) {
  console.error(`Dune refresh failed; previous snapshot preserved. ${error.message}`);
  process.exitCode=1;
}
