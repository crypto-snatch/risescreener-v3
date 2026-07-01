import { NextResponse } from "next/server";
import { getLatestBlocks } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const blocks = await getLatestBlocks(25);
    return NextResponse.json({ blocks });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
