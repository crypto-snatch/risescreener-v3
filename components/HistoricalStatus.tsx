import { getDune } from "@/lib/dune";

export default async function HistoricalStatus() {
  const data=await getDune();
  const through=data?.protocol?.at(-1)?.t ?? data?.volume?.at(-1)?.t;
  if(!through) return null;
  const delayed=Date.now()-through>3*86_400_000;
  return <div className="history-status" role={delayed ? "status" : undefined} data-delayed={delayed}>
    Historical data through {new Date(through).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"})} UTC.
    {delayed ? " Historical updates are delayed; live market feeds continue independently." : " Current UTC day is excluded from daily charts. Individual account and flow series show their own source dates."}
  </div>;
}
