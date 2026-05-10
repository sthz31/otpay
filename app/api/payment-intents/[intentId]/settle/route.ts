import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import {
  DEVNET_USDC_MINT,
  SOLANA_RPC_URL,
  buildUsdcTransferTransaction,
} from "@/lib/solana/usdc";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { settlementSchema } from "@/lib/validation/payment-intent";

export async function POST(
  request: Request,
  context: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = settlementSchema.safeParse({
    ...body,
    paymentIntentId: intentId,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settlement payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const activeProfileId = await getActiveProfileId();

  if (!activeProfileId) {
    return NextResponse.json({ error: "You must be logged in to settle this request." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: paymentIntent, error: lookupError } = await supabase
    .from("payment_intents")
    .select(
      "id, sender_profile_id, recipient_profile_id, amount, currency, status, transaction_signature, approval_method, approved_by_profile_id",
    )
    .eq("id", intentId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (!paymentIntent) {
    return NextResponse.json({ error: "Payment intent not found." }, { status: 404 });
  }

  if (paymentIntent.sender_profile_id !== activeProfileId) {
    return NextResponse.json(
      { error: "Only the payer can sign and settle this request." },
      { status: 403 },
    );
  }

  if (paymentIntent.status === "settled") {
    return NextResponse.json({
      ok: true,
      message: "This request is already settled.",
      data: {
        paymentIntent,
        signature: paymentIntent.transaction_signature,
      },
    });
  }

  if (
    paymentIntent.status !== "approved" ||
    paymentIntent.approval_method !== "payer_link" ||
    paymentIntent.approved_by_profile_id !== activeProfileId
  ) {
    return NextResponse.json(
      { error: "Verify the OTP as the payer before settlement." },
      { status: 409 },
    );
  }

  const { data: payerProfile, error: payerError } = await supabase
    .from("profiles")
    .select("id, wallet_address")
    .eq("id", paymentIntent.sender_profile_id)
    .maybeSingle();

  if (payerError) {
    return NextResponse.json({ error: payerError.message }, { status: 500 });
  }

  const { data: requesterProfile, error: requesterError } = await supabase
    .from("profiles")
    .select("id, wallet_address")
    .eq("id", paymentIntent.recipient_profile_id)
    .maybeSingle();

  if (requesterError) {
    return NextResponse.json({ error: requesterError.message }, { status: 500 });
  }

  if (!payerProfile || !requesterProfile) {
    return NextResponse.json({ error: "Could not find payer or requester wallet." }, { status: 404 });
  }

  if (!parsed.data.signature) {
    const transfer = await buildUsdcTransferTransaction({
      senderWalletAddress: payerProfile.wallet_address,
      recipientWalletAddress: requesterProfile.wallet_address,
      amount: String(paymentIntent.amount),
    });

    return NextResponse.json({
      ok: true,
      message: "Settlement transaction prepared. Sign and send from the payer wallet.",
      data: {
        intentId,
        status: "settling",
        transfer,
      },
    });
  }

  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const confirmation = await connection.confirmTransaction(parsed.data.signature, "confirmed");

  if (confirmation.value.err) {
    return NextResponse.json(
      { error: "Solana transaction failed confirmation.", details: confirmation.value.err },
      { status: 502 },
    );
  }

  const timestamp = new Date().toISOString();
  const { data: updatedPaymentIntent, error: updateError } = await supabase
    .from("payment_intents")
    .update({
      status: "settled",
      transaction_signature: parsed.data.signature,
      settled_at: timestamp,
    })
    .eq("id", intentId)
    .select(
      "id, sender_profile_id, recipient_profile_id, recipient_phone_number, payer_phone_number, amount, currency, note, status, transaction_signature, approval_method, approved_by_profile_id, created_at, updated_at",
    )
    .single();

  if (updateError || !updatedPaymentIntent) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not record settlement." },
      { status: 500 },
    );
  }

  const { error: transactionError } = await supabase.from("transactions").upsert(
    {
      payment_intent_id: intentId,
      signature: parsed.data.signature,
      token_mint: DEVNET_USDC_MINT.toBase58(),
      sender_wallet: payerProfile.wallet_address,
      recipient_wallet: requesterProfile.wallet_address,
      status: "confirmed",
    },
    {
      onConflict: "payment_intent_id",
    },
  );

  if (transactionError) {
    return NextResponse.json({ error: transactionError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Settlement recorded successfully.",
    data: {
      paymentIntent: updatedPaymentIntent,
      transactionSignature: parsed.data.signature,
    },
  });
}
