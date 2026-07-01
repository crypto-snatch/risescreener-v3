import { NextResponse } from "next/server";
import { getLatestTxns } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const txns = await getLatestTxns(50);
    return NextResponse.json({ txns });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
