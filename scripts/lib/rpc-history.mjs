// Event layouts are from the official RISEx frontend ABI, verified against topic hashes.
export const TOPICS = {
  take:"0x3e92827023687af833e2eb9abe60e0726acfc9f7f82839dec79cf9e138b983ff",
  maker:"0x572a85e40cc9183c961148c546e88431898ab9938b85992ea5f6577ea06d9888",
  open:"0x84a3a158a63222227143cec58d75478e65342a3e7e6f7fd07bf1e772a949ce7b",
  config:"0x24c90c81db0bdc77eb5f57f80202ab147e56d84ab424b61f377c2e645d58b1ff",
};
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
  let trades=0;
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
      row.trades++;trades++;users.add(((orderId>>2n)&0xffffffffn).toString());
    } else {
      row.maker+=wad(signed(word(log.data,2)));users.add(((orderId>>1n)&0xffffffffn).toString());
    }
  }
  const sum=key=>Object.values(markets).reduce((s,m)=>s+m[key],0);
  return {t:start,volume:sum("volume"),taker:sum("taker"),maker:sum("maker"),liq:sum("liq"),
    trades,activeUserIds:users.size,markets};
}
