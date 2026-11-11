// Event layouts are from the official RISEx frontend ABI, verified against topic hashes.
export const TOPICS = {
  take:"0x3e92827023687af833e2eb9abe60e0726acfc9f7f82839dec79cf9e138b983ff",
  maker:"0x572a85e40cc9183c961148c546e88431898ab9938b85992ea5f6577ea06d9888",
  open:"0x84a3a158a63222227143cec58d75478e65342a3e7e6f7fd07bf1e772a949ce7b",
  config:"0x24c90c81db0bdc77eb5f57f80202ab147e56d84ab424b61f377c2e645d58b1ff",
};
// CollateralManager events, matched to the cent against the Dune seed's daily
// deposits/withdrawals (2026-10-24 and 2026-10-27). Both carry
// (account, sender/recipient, token) indexed and the token amount as data.
export const COLLATERAL_TOPICS = {
  deposit:"0x1a52dc5f1a697e41465e09288950bab46daf62b3558244f71c7eee6ec1872a88",
  withdraw:"0xba06d99e13a05820f144f5b669e4cb8c1299da99a36cd44ab9e971975627c6a0",
};
export const USDC_TOPIC="0x000000000000000000000000e436820ba0c69702c1d3e601d421c0ef38262739";
export const word=(data,index)=> {
  const value=data.slice(2+index*64,2+(index+1)*64);
  if(value.length!==64) throw new Error("Unexpected event layout; history left unchanged");
  return BigInt(`0x${value}`);
};
const signed=value=>value >= 1n<<255n ? value-(1n<<256n) : value;
const wad=value=>Number(value)/1e18;
function tuple(data,index) {
  const start=Number(word(data,index))/32;
  const nameAt=start+Number(word(data,start))/32;
  const length=Number(word(data,nameAt));
  if(length>200) throw new Error("Unexpected market name length");
  const name=Buffer.from(data.slice(2+(nameAt+1)*64,2+(nameAt+1)*64+length*2),"hex").toString("utf8");
  return {symbol:name.split("/")[0],stepPrice:word(data,start+9)};
}
export function configEvent(log) {
  if(log.topics[0]===TOPICS.open) return {id:Number(BigInt(log.topics[1])),next:tuple(log.data,0)};
  if(log.topics[0]===TOPICS.config) return {id:Number(BigInt(log.topics[1])),previous:tuple(log.data,0),next:tuple(log.data,1)};
  return null;
}
export function aggregateDay(logs,initialConfig,start,end) {
  const configs=new Map(initialConfig),markets={},users=new Set();
  let trades=0,maxUserId=0;
  const seen=id=>{users.add(id.toString());if(Number(id)>maxUserId) maxUserId=Number(id);};
  for(const log of logs) {
    const config=configEvent(log);
    if(config) {configs.set(config.id,config.next);continue;}
    if(![TOPICS.take,TOPICS.maker].includes(log.topics[0])) continue;
    const timestamp=Number(BigInt(log.blockTimestamp))*1000;
    if(timestamp<start || timestamp>=end) continue;
    const id=Number(BigInt(log.topics[1])),market=configs.get(id);
    if(!market?.stepPrice) throw new Error(`Missing price-step configuration for market ${id}`);
    const row=markets[market.symbol] ??= {volume:0,taker:0,maker:0,liq:0,trades:0};
    const orderId=BigInt(log.topics[2]);
    if(log.topics[0]===TOPICS.take) {
      // Multiply in integer space first: size (WAD) × tick × price step (WAD).
      row.volume+=Number(word(log.data,1)*word(log.data,0)*market.stepPrice)/1e36;
      row.taker+=wad(signed(word(log.data,2)));row.liq+=wad(signed(word(log.data,3)));
      row.trades++;trades++;seen((orderId>>2n)&0xffffffffn);
    } else {
      row.maker+=wad(signed(word(log.data,2)));seen((orderId>>1n)&0xffffffffn);
    }
  }
  const sum=key=>Object.values(markets).reduce((s,m)=>s+m[key],0);
  return {t:start,volume:sum("volume"),taker:sum("taker"),maker:sum("maker"),liq:sum("liq"),
    trades,activeUserIds:users.size,maxUserId,markets};
}
// Daily USDC collateral moved in and out of the CollateralManager.
export function aggregateCollateral(logs,start,end) {
  let deposits=0n,withdrawals=0n;
  for(const log of logs) {
    const isDeposit=log.topics[0]===COLLATERAL_TOPICS.deposit;
    if(!isDeposit && log.topics[0]!==COLLATERAL_TOPICS.withdraw) continue;
    const timestamp=Number(BigInt(log.blockTimestamp))*1000;
    if(timestamp<start || timestamp>=end) continue;
    // A second collateral token would need its own price; refuse rather than add units.
    if(log.topics[3]!==USDC_TOPIC) throw new Error("Unexpected collateral token; history left unchanged");
    if(isDeposit) deposits+=word(log.data,0);else withdrawals+=word(log.data,0);
  }
  return {deposits:Number(deposits)/1e6,withdrawals:Number(withdrawals)/1e6};
}
