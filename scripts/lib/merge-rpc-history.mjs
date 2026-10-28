// Complete contiguous RPC days extend the seed. Overlapping days are never added twice.
export function mergeRpcHistory(base,history,catalog,now=Date.now()) {
  if(!base?.protocol?.length || !history?.days?.length) return base;
  const result=structuredClone(base),DAY=86_400_000,today=Math.floor(now/DAY)*DAY;
  let through=result.protocol.at(-1).t;
  const symbols=Object.keys(catalog.markets).filter(s=>catalog.markets[s].assetClass!=="Crypto");
  const blank=t=>({t,BTC:0,ETH:0,SOL:0,HYPE:0,...Object.fromEntries(symbols.map(s=>[s,0])),Commodities:0,Stocks:0,RWA:0,Others:0});
  const add=(row,symbol,value)=>{
    const assetClass=catalog.markets[symbol]?.assetClass;
    if(["Commodities","Stocks"].includes(assetClass)) {row[symbol]=(row[symbol]??0)+value;row[assetClass]+=value;row.RWA+=value;}
    else row[["BTC","ETH","SOL","HYPE"].includes(symbol)?symbol:"Others"]+=value;
  };
  for(const day of [...history.days].sort((a,b)=>a.t-b.t)) {
    if(day.t<=through || day.t>=today) continue;
    if(day.t!==through+DAY) break;
    const volume=blank(day.t),fees=blank(day.t),liq=blank(day.t);
    for(const [symbol,market] of Object.entries(day.markets)) {
      add(volume,symbol,market.volume);add(fees,symbol,market.taker);add(liq,symbol,market.liq);
    }
    result.volume.push(volume);result.feesByMarket.push(fees);result.liqFeesByMarket.push(liq);
    result.protocol.push({t:day.t,volume:day.volume,trades:day.trades,taker:day.taker,maker:day.maker,liq:day.liq,activeTraders:day.activeUserIds,source:"public-rpc"});
    result.totals.cumVolume+=day.volume;result.totals.cumTrades+=day.trades;
    result.totals.cumFees+=day.taker+day.maker+day.liq;
    result.totals.cumVolumeCmd+=volume.Commodities;result.totals.cumVolumeStk+=volume.Stocks;
    result.totals.cumVolumeRwa+=volume.RWA;result.totals.cumVolumeCrypto+=day.volume-volume.RWA;
    result.fees.taker+=day.taker;result.fees.maker+=day.maker;result.fees.liq+=day.liq;
    result.fees.total+=day.taker+day.maker;
    through=day.t;
  }
  result.rpcThrough=through;result.rpcUpdatedAt=history.generatedAt;
  return result;
}
