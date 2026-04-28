import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await context.params;
  const supabase = getSupabaseServerClient();

  const { data: paymentIntent, error } = await supabase
    .from("payment_intents")
    .select(
      "id, sender_profile_id, recipient_profile_id, recipient_phone_number, amount, currency, note, status, transaction_signature, created_at, updated_at",
    )
    .eq("id", intentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!paymentIntent) {
    return NextResponse.json({ error: "Payment intent not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    message: "Payment intent loaded.",
    data: paymentIntent,
  });
}
