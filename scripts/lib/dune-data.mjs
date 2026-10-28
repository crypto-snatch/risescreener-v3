const DAY = 86_400_000;
export const utcTime = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : text.replace(" ", "T") + "Z");
};
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const sum = (rows, key) => rows.reduce((total, row) => total + n(row[key]), 0);
const BIG = ["BTC", "ETH", "SOL", "HYPE"];

export function buildDuneData(results, catalog, now = Date.now()) {
  const today = Math.floor(now / DAY) * DAY;
  const completed = (rows, field) => rows.filter(r => Number.isFinite(utcTime(r[field])) && utcTime(r[field]) < today);
  const volumeRows = completed(results.volumeByMarket.rows, "period");
  const protoRows = completed(results.protocolDaily.rows, "day").sort((a,b) => utcTime(a.day)-utcTime(b.day));
  const accountRows = completed(results.accountsDaily.rows, "period");
  const tvlRows = completed(results.tvlDaily.rows, "day");
  if (!volumeRows.length || !protoRows.length || !accountRows.length || !tvlRows.length)
    throw new Error("Incomplete Dune result set; preserving the previous snapshot");
  const symbols = Object.keys(catalog.markets).filter(s => catalog.markets[s].assetClass !== "Crypto");
  const blank = t => ({ t, BTC:0, ETH:0, SOL:0, HYPE:0,
    ...Object.fromEntries(symbols.map(s => [s,0])), Commodities:0, Stocks:0, RWA:0, Others:0 });
  const byDay = new Map(), feeDay = new Map(), liqDay = new Map();
  const add = (day,symbol,value) => {
    const assetClass = catalog.markets[symbol]?.assetClass;
    if (assetClass === "Commodities" || assetClass === "Stocks") {
      day[symbol] = n(day[symbol]) + value; day[assetClass] += value; day.RWA += value;
    } else day[BIG.includes(symbol) ? symbol : "Others"] += value;
  };
  for (const row of volumeRows) {
    const t=utcTime(row.period), symbol=String(row.market_name).split("/")[0];
    for (const map of [byDay,feeDay,liqDay]) if (!map.has(t)) map.set(t,blank(t));
    add(byDay.get(t),symbol,n(row.daily_volume_usd));
    // The query's `daily_total_fees_usd` already includes liquidation fees.
    // Use explicit components to avoid counting liquidation revenue twice.
    add(feeDay.get(t),symbol,n(row.daily_taker_fees_usd)+n(row.daily_maker_fees_usd));
    add(liqDay.get(t),symbol,n(row.daily_liquidation_fees_usd));
  }
  const sorted = map => [...map.values()].sort((a,b)=>a.t-b.t);
  let volume=sorted(byDay), feesByMarket=sorted(feeDay), liqFeesByMarket=sorted(liqDay);
  const dayTotal = row => BIG.reduce((s,k)=>s+n(row[k]),0)+n(row.RWA)+n(row.Others);
  while (volume.length && dayTotal(volume.at(-1)) === 0) {
    const t=volume.pop().t;
    feesByMarket=feesByMarket.filter(d=>d.t!==t);liqFeesByMarket=liqFeesByMarket.filter(d=>d.t!==t);
  }
  if (!volume.length) throw new Error("Dune returned no nonzero volume history");
  const protocol=protoRows.map(r=>({t:utcTime(r.day),volume:n(r.daily_volume_usd),trades:n(r.daily_trades),
    taker:n(r.daily_taker_fees_usd),maker:n(r.daily_maker_fees_usd),liq:n(r.daily_liquidation_fees_usd)}));
  const latest=protoRows.at(-1);
  const taker=n(latest.cumulative_taker_fees_usd ?? latest.cumulative_trading_fees_usd);
  const maker=n(latest.cumulative_maker_fees_usd), liquidation=n(latest.cumulative_liquidation_fees_usd);
  const tvl=tvlRows.map(r=>({t:utcTime(r.day),tvl:n(r.cumulative_tvl),deposits:n(r.deposits),
    withdrawals:n(r.withdrawals),net:n(r.net_flow)})).sort((a,b)=>a.t-b.t);
  const accounts=accountRows.map(r=>({t:utcTime(r.period),newAccounts:n(r.new_accounts),
    activeTraders:n(r.active_traders),cumAccounts:n(r.cumulative_accounts)})).sort((a,b)=>a.t-b.t);
  const oi=results.oiNow.rows, liq=results.liqTotals.rows[0] ?? {};
  const cumVolume=n(latest.cumulative_volume_usd),cmd=sum(volume,"Commodities"),stk=sum(volume,"Stocks");
  return {
    schemaVersion:2, generatedAt:new Date(now).toISOString(),
    sources:Object.fromEntries(Object.entries(results).map(([name,r])=>[name,{
      queryId:r.queryId,executionId:r.executionId ?? null,executionEndedAt:r.execEndedAt ?? null,
      retrievedAt:r.retrievedAt ?? new Date(now).toISOString(),rows:r.rows.length,
    }])),
    totals:{cumVolume,cumVolumeRwa:cmd+stk,cumVolumeCmd:cmd,cumVolumeStk:stk,
      cumVolumeCrypto:Math.max(0,cumVolume-cmd-stk),cumFees:taker+maker+liquidation,
      cumTrades:n(latest.cumulative_trades),accounts:accounts.at(-1).cumAccounts,tvl:tvl.at(-1).tvl,
      oi:n(oi[0]?.total_oi_usd)},
    volume,feesByMarket,liqFeesByMarket,protocol,
    fees:{total:taker+maker,taker,maker,liq:liquidation},
    feeMarketCoverage: volumeRows.some(r=>r.daily_maker_fees_usd != null) ? "maker+taker" : "taker",
    liqTotals:{count:n(liq.alltime_liquidation_count),volume:n(liq.alltime_liquidation_volume_usd),
      fees:n(liq.alltime_liquidation_fees_usd),dailyCount:n(liq.daily_liquidation_count),
      dailyVolume:n(liq.daily_liquidation_volume_usd),dailyFees:n(liq.daily_liquidation_fees_usd)},
    tvl,accounts,oiByMarket:oi.map(r=>({symbol:String(r.market_name).split("/")[0],oiUsd:n(r.oi_usd)}))
      .sort((a,b)=>b.oiUsd-a.oiUsd),
  };
}
