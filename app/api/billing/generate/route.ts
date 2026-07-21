import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  const client = await createClient();
  if (!client)
    return NextResponse.json(
      { error: "Supabaseが設定されていません" },
      { status: 503 },
    );
  const body = (await request.json()) as { billingMonth?: string };
  if (!body.billingMonth)
    return NextResponse.json({ error: "請求月は必須です" }, { status: 400 });
  const { data, error } = await client.rpc("generate_monthly_charges", {
    target_month: `${body.billingMonth.slice(0, 7)}-01`,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data?.[0] ?? { created_count: 0, skipped_count: 0 });
}
