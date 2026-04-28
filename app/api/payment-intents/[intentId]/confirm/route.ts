import { NextResponse } from "next/server";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { paymentIntentConfirmSchema } from "@/lib/validation/payment-intent";

const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

function createDemoSignature(intentId: string) {
  return `demo_tx_${intentId.replace(/-/g, "").slice(0, 20)}_${Date.now().toString(36)}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await context.params;
  const body = await request.json();
  const parsed = paymentIntentConfirmSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid confirmation payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const activeProfileId = await getActiveProfileId();

  if (!activeProfileId) {
    return NextResponse.json({ error: "You must be logged in to confirm requests." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: paymentIntent, error: paymentIntentError } = await supabase
    .from("payment_intents")
    .select(
      "id, status, amount, currency, approval_otp, sender_profile_id, recipient_profile_id",
    )
    .eq("id", intentId)
    .maybeSingle();

  if (paymentIntentError) {
    return NextResponse.json({ error: paymentIntentError.message }, { status: 500 });
  }

  if (!paymentIntent) {
    return NextResponse.json({ error: "Payment intent not found." }, { status: 404 });
  }

  if (paymentIntent.status !== "pending") {
    return NextResponse.json(
      { error: `This payment request is already ${paymentIntent.status}.` },
      { status: 409 },
    );
  }

  if (paymentIntent.sender_profile_id !== activeProfileId) {
    return NextResponse.json(
      { error: "Only the logged-in sender can confirm this transaction." },
      { status: 403 },
    );
  }

  if (paymentIntent.approval_otp !== parsed.data.otp) {
    return NextResponse.json(
      { error: "Incorrect OTP for this requested number." },
      { status: 401 },
    );
  }

  const { data: recipientProfile, error: recipientProfileError } = await supabase
    .from("profiles")
    .select("id, wallet_address")
    .eq("id", paymentIntent.recipient_profile_id)
    .maybeSingle();

  if (recipientProfileError) {
    return NextResponse.json({ error: recipientProfileError.message }, { status: 500 });
  }

  if (!recipientProfile) {
    return NextResponse.json({ error: "Recipient profile not found." }, { status: 404 });
  }

  const { data: senderProfile, error: senderProfileError } = await supabase
    .from("profiles")
    .select("id, display_name, wallet_address")
    .eq("id", paymentIntent.sender_profile_id)
    .maybeSingle();

  if (senderProfileError) {
    return NextResponse.json({ error: senderProfileError.message }, { status: 500 });
  }

  if (!senderProfile) {
    return NextResponse.json({ error: "Sender profile not found." }, { status: 404 });
  }

  const signature = createDemoSignature(intentId);
  const timestamp = new Date().toISOString();
  const configuredMint = process.env.NEXT_PUBLIC_DEVNET_USDC_MINT?.trim();
  const tokenMint =
    configuredMint && configuredMint.length >= 32 ? configuredMint : DEVNET_USDC_MINT;

  const { data: updatedPaymentIntent, error: updateError } = await supabase
    .from("payment_intents")
    .update({
      status: "settled",
      transaction_signature: signature,
      approval_otp: null,
      approved_at: timestamp,
      settled_at: timestamp,
    })
    .eq("id", intentId)
    .select(
      "id, sender_profile_id, recipient_profile_id, recipient_phone_number, amount, currency, note, status, transaction_signature, created_at, updated_at",
    )
    .single();

  if (updateError || !updatedPaymentIntent) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not complete this transaction." },
      { status: 500 },
    );
  }

  const { error: transactionError } = await supabase.from("transactions").upsert(
    {
      payment_intent_id: intentId,
      signature,
      token_mint: tokenMint,
      sender_wallet: senderProfile.wallet_address,
      recipient_wallet: recipientProfile.wallet_address,
      status: "confirmed",
    },
    {
      onConflict: "payment_intent_id",
    },
  );

  if (transactionError) {
    return NextResponse.json(
      { error: transactionError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Transaction confirmed successfully.",
    data: {
      paymentIntent: updatedPaymentIntent,
      senderProfile: {
        id: senderProfile.id,
        display_name: senderProfile.display_name,
      },
      transactionSignature: signature,
    },
  });
}
