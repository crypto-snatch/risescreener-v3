import { NextResponse } from "next/server";
import { getChainStats } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getChainStats();
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
