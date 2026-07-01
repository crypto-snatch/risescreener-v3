import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccountSnapshot } from "@/lib/account";
import { getMarketMap, symbolOf } from "@/lib/risex";
import { isAddress, shortAddr } from "@/lib/format";
import { EXPLORER_UI } from "@/lib/constants";
import AddressView from "@/components/AddressView";

export const dynamic = "force-dynamic";

export default async function AddressPage({ params }: { params: { addr: string } }) {
  const addr = params.addr;
  if (!isAddress(addr)) notFound();

  const [snap, marketMap] = await Promise.all([
    getAccountSnapshot(addr, { withTxns: true }),
    getMarketMap(),
  ]);
  const symbols: Record<string, string> = {};
  marketMap.forEach((m, id) => (symbols[id] = symbolOf(m)));

  return (
    <div className="screen" data-page="address" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{shortAddr(addr)}</h1>
        <span className="text-muted" style={{ fontSize: 12, wordBreak: "break-all" }}>{addr}</span>
        <a href={`${EXPLORER_UI}/address/${addr}`} target="_blank" rel="noreferrer" className="chip text-accent">explorer ↗</a>
        <Link href="/" className="text-muted" style={{ marginLeft: "auto", fontSize: 12 }}>← home</Link>
      </div>
      <AddressView addr={addr} initial={{ ...snap, symbols }} />
    </div>
  );
}
