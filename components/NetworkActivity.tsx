"use client";
import {ResponsiveContainer,ComposedChart,Bar,Line,XAxis,YAxis,CartesianGrid,Tooltip} from "recharts";
import type {BlockRow} from "@/lib/chain";
import ChartCard from "./ChartCard";

export default function NetworkActivity({blocks}:{blocks:BlockRow[]}) {
  const points=[...blocks].sort((a,b)=>a.height-b.height).map(b=>({...b,load:b.gasLimit>0?b.gasUsed/b.gasLimit*100:null}));
  const gas=points.some(p=>p.load!=null);
  return <ChartCard title="Block activity" subtitle={`Latest ${points.length} sealed blocks · observed transaction count${gas?" and gas utilization":""}`} height={270} filename="risescreener-block-activity"
    legend={[{name:"Transactions · left axis",color:"#35c98d"},...(gas?[{name:"Gas utilization · right axis",color:"#98aaff"}]:[])]}>
    {points.length?<ResponsiveContainer width="100%" height="100%"><ComposedChart data={points} margin={{top:12,right:0,bottom:4,left:0}}>
      <CartesianGrid stroke="var(--hair)" vertical={false} strokeDasharray="3 5"/>
      <XAxis dataKey="height" tickFormatter={v=>`#${String(v).slice(-4)}`} minTickGap={30} axisLine={false} tickLine={false} tick={{fill:"var(--muted-2)",fontSize:9}}/>
      <YAxis yAxisId="tx" width={40} axisLine={false} tickLine={false} tick={{fill:"var(--muted-2)",fontSize:10}}/>
      <YAxis yAxisId="gas" orientation="right" width={35} hide={!gas} domain={[0,100]} tickFormatter={v=>`${v}%`} axisLine={false} tickLine={false} tick={{fill:"var(--muted-2)",fontSize:9}}/>
      <Tooltip content={({active,payload})=>{const p=payload?.[0]?.payload as typeof points[number]|undefined;return active&&p?<div className="analytics-tooltip"><b>Block #{p.height.toLocaleString()}</b><div><span>Transactions</span><strong>{p.txCount.toLocaleString()}</strong></div>{p.load!=null&&<div><span>Gas utilization</span><strong>{p.load.toFixed(1)}%</strong></div>}<div><span>Sealed at</span><strong>{new Date(p.timestampMs).toLocaleTimeString("en-GB",{timeZone:"UTC"})} UTC</strong></div></div>:null;}}/>
      <Bar dataKey="txCount" yAxisId="tx" fill="#35c98d" fillOpacity={0.55} radius={[3,3,0,0]} isAnimationActive={false}/>
      {gas&&<Line dataKey="load" yAxisId="gas" stroke="#98aaff" strokeWidth={2} dot={false} isAnimationActive={false}/>}
    </ComposedChart></ResponsiveContainer>:<div className="analytics-empty">Recent blocks are temporarily unavailable. The live stream continues independently.</div>}
  </ChartCard>;
}
