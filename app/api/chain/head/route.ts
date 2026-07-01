import { NextResponse } from "next/server";
import { getChainHead } from "@/lib/chain";

export const dynamic = "force-dynamic";

// Latest block + its transactions, straight from the chain tip (RPC).
export async function GET() {
  try {
    const head = await getChainHead();
    return NextResponse.json(head);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
