import { NextResponse } from "next/server";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { paymentIntentDecisionSchema } from "@/lib/validation/payment-intent";

export async function POST(
  request: Request,
  context: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await context.params;
  const body = await request.json();
  const parsed = paymentIntentDecisionSchema.safeParse({
    ...body,
    action: "approve",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid approval payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const activeProfileId = await getActiveProfileId();

  if (!activeProfileId) {
    return NextResponse.json({ error: "You must be logged in to approve requests." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: paymentIntent, error: lookupError } = await supabase
    .from("payment_intents")
    .select("id, recipient_profile_id, status")
    .eq("id", intentId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (!paymentIntent) {
    return NextResponse.json({ error: "Payment intent not found." }, { status: 404 });
  }

  if (paymentIntent.recipient_profile_id !== activeProfileId) {
    return NextResponse.json(
      { error: "Only the intended recipient can approve this request." },
      { status: 403 },
    );
  }

  if (paymentIntent.status !== "pending") {
    return NextResponse.json(
      { error: `This request is already ${paymentIntent.status}.` },
      { status: 409 },
    );
  }

  const { data: updatedIntent, error: updateError } = await supabase
    .from("payment_intents")
    .update({ status: "approved" })
    .eq("id", intentId)
    .select(
      "id, sender_profile_id, recipient_profile_id, recipient_phone_number, amount, currency, note, status, transaction_signature, created_at, updated_at",
    )
    .single();

  if (updateError || !updatedIntent) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not approve payment intent." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Payment intent approved.",
    data: {
      paymentIntent: updatedIntent,
    },
  });
}
