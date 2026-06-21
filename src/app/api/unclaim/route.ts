import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { claims } = await req.json() as {
    claims: { itemId: string; delta: number }[];
  };

  for (const { itemId, delta } of claims) {
    if (delta !== 0) {
      await supabase.rpc("claim_delta", { p_item: itemId, p_delta: delta });
    }
  }

  return NextResponse.json({ ok: true });
}
