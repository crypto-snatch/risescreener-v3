import { NextResponse } from "next/server";
import { getTx } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { hash: string } },
) {
  const hash = params.hash;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return NextResponse.json({ error: "invalid tx hash" }, { status: 400 });
  }
  const tx = await getTx(hash);
  if (!tx) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json(tx);
}
