"use client";
import {useMemo,useState} from "react";
import {ResponsiveContainer,ScatterChart,Scatter,XAxis,YAxis,ZAxis,CartesianGrid,Tooltip,Cell,
  BarChart,Bar,ComposedChart,Line,ReferenceLine} from "recharts";
import type {MarketRow} from "@/lib/analytics";
import {assetClassOf,CLASS_COLOR,type AssetClass} from "@/lib/sectors";
import {usd} from "@/lib/format";
import ChartCard from "./ChartCard";

const CLASSES:AssetClass[]=["Crypto","Stocks","Commodities"];
const axis={fill:"var(--muted-2)",fontSize:10};
const margin={top:15,right:12,bottom:8,left:0};
const date=(t:number)=>new Date(t).toLocaleDateString("en-GB",{day:"2-digit",month:"short",timeZone:"UTC"});
function Tip({title,rows}:{title:string;rows:[string,string][]}) {
  return <div className="analytics-tooltip"><b>{title}</b>{rows.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}
export function MarketMap({markets,mode="activity"}:{markets:MarketRow[];mode?:"activity"|"funding"}) {
  const [selected,setSelected]=useState<AssetClass|"All">("All");
  const data=markets.filter(m=>m.volume24h>0&&m.mark>0&&(selected==="All"||assetClassOf(m.symbol)===selected))
    .map(m=>({...m,y:mode==="activity"?m.changePct:m.funding8h*100,color:CLASS_COLOR[assetClassOf(m.symbol)]}));
  const title=mode==="activity"?"Market activity map":"Funding pressure map";
  return <ChartCard title={title} subtitle={mode==="activity"?"24h price change vs volume · bubble size = open interest":"8h funding vs 24h volume · positive funding means longs pay"}
    height={310} filename={`risescreener-${mode}-map`} controls={<div className="chart-filters">{(["All",...CLASSES] as const).map(c=><button key={c} onClick={()=>setSelected(c)} aria-pressed={selected===c}>{c}</button>)}<span className="chart-axis-note">Volume in USD · log scale</span></div>}
    legend={CLASSES.map(c=>({name:c,color:CLASS_COLOR[c]}))}>
    {data.length?<ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={margin}>
        <CartesianGrid stroke="var(--hair)" strokeDasharray="3 5" vertical={false}/>
        <XAxis type="number" dataKey="volume24h" scale="log" domain={[(min:number)=>min/1.25,(max:number)=>max*1.25]} tickFormatter={v=>usd(v)} tick={axis} axisLine={false} tickLine={false} height={28}/>
        <YAxis type="number" dataKey="y" tickFormatter={v=>`${Number(v).toFixed(mode==="activity"?0:3)}%`} tick={axis} axisLine={false} tickLine={false} width={55}/>
        <ZAxis type="number" dataKey="oiUsd" range={[55,750]}/>
        <ReferenceLine y={0} stroke="var(--muted-2)" strokeDasharray="4 4"/>
        <Tooltip cursor={{stroke:"var(--hair)"}} content={({active,payload})=>{
          const row=payload?.[0]?.payload as typeof data[number]|undefined;
          return active&&row?<Tip title={row.symbol} rows={[["24h volume",usd(row.volume24h)],["Open interest",usd(row.oiUsd)],["24h change",`${row.changePct>=0?"+":""}${row.changePct.toFixed(2)}%`],["Funding / 8h",`${(row.funding8h*100).toFixed(4)}%`]]}/>:null;
        }}/>
        <Scatter data={data} isAnimationActive={false}>{data.map(d=><Cell key={d.marketId} fill={d.color} fillOpacity={0.72} stroke={d.color} strokeWidth={1}/>)}</Scatter>
      </ScatterChart>
    </ResponsiveContainer>:<div className="analytics-empty">No markets with observed volume in this category.</div>}
  </ChartCard>;
}

export function MarketBreadth({markets}:{markets:MarketRow[]}) {
  const data=CLASSES.map(name=>{
    const rows=markets.filter(m=>m.mark>0&&assetClassOf(m.symbol)===name);
    return {name,up:rows.filter(m=>m.changePct>0.001).length,down:rows.filter(m=>m.changePct<-.001).length,flat:rows.filter(m=>Math.abs(m.changePct)<=.001).length};
  });
  const total=data.reduce((s,d)=>s+d.up+d.down+d.flat,0),advancers=data.reduce((s,d)=>s+d.up,0);
  return <ChartCard title="Market breadth" subtitle="Advancing, declining and unchanged markets · 24h price changes" height={230}
    filename="risescreener-market-breadth" toolbar={<span className="chart-metric">{total?Math.round(advancers/total*100):0}% <small>advancing</small></span>}
    legend={[{name:"Advancing",color:"#35c98d"},{name:"Declining",color:"#e46a7b"},{name:"Unchanged",color:"#7e8e88"}]}>
    <ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{top:16,right:24,bottom:10,left:0}} barSize={25}>
      <CartesianGrid stroke="var(--hair)" horizontal={false} strokeDasharray="3 5"/>
      <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false}/>
      <YAxis type="category" dataKey="name" width={90} tick={axis} axisLine={false} tickLine={false}/>
      <Tooltip cursor={{fill:"var(--glass-2)"}} content={({active,payload})=>{
        const row=payload?.[0]?.payload as typeof data[number]|undefined;
        return active&&row?<Tip title={row.name} rows={[["Advancing",String(row.up)],["Declining",String(row.down)],["Unchanged",String(row.flat)]]}/>:null;
      }}/>
      <Bar dataKey="up" stackId="breadth" fill="#35c98d" isAnimationActive={false}/><Bar dataKey="down" stackId="breadth" fill="#e46a7b" isAnimationActive={false}/><Bar dataKey="flat" stackId="breadth" fill="#7e8e88" radius={[0,4,4,0]} isAnimationActive={false}/>
    </BarChart></ResponsiveContainer>
  </ChartCard>;
}

export type ProtocolDay={t:number;volume:number;taker:number;maker:number;liq:number};
export function FeeEfficiency({days}:{days:ProtocolDay[]}) {
  const [range,setRange]=useState(30);
  const points=useMemo(()=>days.filter(d=>d.volume>0).slice(-range).map(d=>({...d,fees:d.taker+d.maker+d.liq,bps:(d.taker+d.maker+d.liq)/d.volume*10_000})),[days,range]);
  const volume=points.reduce((s,d)=>s+d.volume,0),fees=points.reduce((s,d)=>s+d.fees,0);
  return <ChartCard title="Volume & fee yield" subtitle="Complete UTC days · net maker/taker fees plus liquidation fees" height={300} filename="risescreener-volume-fee-yield"
    toolbar={<span className="chart-metric">{volume?(fees/volume*10_000).toFixed(2):"—"} <small>bps</small></span>}
    controls={<div className="chart-filters">{[7,30,90].map(n=><button key={n} onClick={()=>setRange(n)} aria-pressed={range===n}>{n}D</button>)}</div>}
    legend={[{name:"Volume · left axis",color:"#35c98d"},{name:"Fee yield · right axis",color:"#98aaff"}]}>
    {points.length>1?<ResponsiveContainer width="100%" height="100%"><ComposedChart data={points} margin={{top:10,right:0,bottom:4,left:0}}>
      <CartesianGrid stroke="var(--hair)" vertical={false} strokeDasharray="3 5"/>
      <XAxis dataKey="t" tickFormatter={date} minTickGap={34} tick={axis} axisLine={false} tickLine={false}/>
      <YAxis yAxisId="volume" tickFormatter={v=>usd(v)} tick={axis} width={57} axisLine={false} tickLine={false}/>
      <YAxis yAxisId="bps" orientation="right" tickFormatter={v=>Number(v).toFixed(1)} tick={axis} width={32} axisLine={false} tickLine={false}/>
      <Tooltip content={({active,payload})=>{const d=payload?.[0]?.payload as typeof points[number]|undefined;return active&&d?<Tip title={date(d.t)+" UTC"} rows={[["Traded volume",usd(d.volume)],["Net protocol fees",usd(d.fees)],["Fee yield",`${d.bps.toFixed(2)} bps`]]}/>:null;}}/>
      <Bar yAxisId="volume" dataKey="volume" fill="#35c98d" fillOpacity={0.35} radius={[3,3,0,0]} isAnimationActive={false}/>
      <Line yAxisId="bps" dataKey="bps" type="monotone" stroke="#98aaff" strokeWidth={2} dot={false} isAnimationActive={false}/>
    </ComposedChart></ResponsiveContainer>:<div className="analytics-empty">Complete daily fee observations are not available yet.</div>}
  </ChartCard>;
}
