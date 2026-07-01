import { NextResponse } from "next/server";
import { getAccountSnapshot } from "@/lib/account";
import { getMarketMap, symbolOf } from "@/lib/risex";
import { isAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { addr: string } },
) {
  const addr = params.addr;
  if (!isAddress(addr)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  try {
    const [snap, marketMap] = await Promise.all([
      getAccountSnapshot(addr, { withTxns: true }),
      getMarketMap(),
    ]);
    const symbols: Record<string, string> = {};
    marketMap.forEach((m, id) => (symbols[id] = symbolOf(m)));
    return NextResponse.json({ ...snap, symbols });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 502 },
    );
  }
}
