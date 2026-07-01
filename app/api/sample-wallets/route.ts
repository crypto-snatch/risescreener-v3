import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

// Real, interesting wallets (top traders by OI / volume / uPnL) for the
// "random wallet" shortcut in the Account Explorer.
export async function GET() {
  const s = await getSnapshot();
  const set = new Set<string>();
  if (s) for (const r of [...s.byOI, ...s.byVolume, ...s.byUpnl]) set.add(r.account);
  return NextResponse.json({ wallets: [...set] });
}
