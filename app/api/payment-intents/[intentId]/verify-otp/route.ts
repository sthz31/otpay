import { NextResponse } from "next/server";
import { DEVNET_USDC_MINT, sendCustodialUsdcTransfer } from "@/lib/solana/usdc";
import { verifyPaymentOtp } from "@/lib/auth/otp";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { decryptWalletSecret } from "@/lib/solana/custodial-wallet";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { paymentIntentConfirmSchema } from "@/lib/validation/payment-intent";

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
        error: "Invalid OTP payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const activeProfileId = await getActiveProfileId();

  if (!activeProfileId) {
    return NextResponse.json({ error: "You must be logged in to verify this OTP." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: paymentIntent, error: paymentIntentError } = await supabase
    .from("payment_intents")
    .select(
      "id, status, amount, currency, approval_otp_hash, approval_otp_expires_at, sender_profile_id, recipient_profile_id, approval_method, approved_by_profile_id, transaction_signature",
    )
    .eq("id", intentId)
    .maybeSingle();

  if (paymentIntentError) {
    return NextResponse.json({ error: paymentIntentError.message }, { status: 500 });
  }

  if (!paymentIntent) {
    return NextResponse.json({ error: "Payment intent not found." }, { status: 404 });
  }

  if (paymentIntent.status === "settled") {
    return NextResponse.json({
      ok: true,
      message: "This payment request is already settled.",
      data: {
        paymentIntent,
        transactionSignature: paymentIntent.transaction_signature,
        canSettle: false,
      },
    });
  }

  if (paymentIntent.status !== "pending" && paymentIntent.status !== "approved") {
    return NextResponse.json(
      { error: `This payment request is already ${paymentIntent.status}.` },
      { status: 409 },
    );
  }

  if (
    paymentIntent.sender_profile_id !== activeProfileId &&
    paymentIntent.recipient_profile_id !== activeProfileId
  ) {
    return NextResponse.json(
      { error: "Only the payer or requester can verify this OTP." },
      { status: 403 },
    );
  }

  if (
    paymentIntent.approval_otp_expires_at &&
    new Date(paymentIntent.approval_otp_expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ error: "This OTP has expired. Create a new request." }, { status: 401 });
  }

  if (
    !verifyPaymentOtp({
      intentId,
      otp: parsed.data.otp,
      otpHash: paymentIntent.approval_otp_hash,
    })
  ) {
    return NextResponse.json({ error: "Incorrect OTP for this payment request." }, { status: 401 });
  }

  const approvalMethod =
    paymentIntent.sender_profile_id === activeProfileId ? "payer_link" : "shared_otp";

  const { data: payerProfile, error: payerError } = await supabase
    .from("profiles")
    .select("id, wallet_address, encrypted_wallet_secret")
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

  if (!payerProfile.encrypted_wallet_secret) {
    return NextResponse.json(
      { error: "Payer test wallet secret is missing. Re-register this test user." },
      { status: 409 },
    );
  }

  let transfer: Awaited<ReturnType<typeof sendCustodialUsdcTransfer>>;

  try {
    transfer = await sendCustodialUsdcTransfer({
      payerSecretKey: decryptWalletSecret(payerProfile.encrypted_wallet_secret),
      request: {
        senderWalletAddress: payerProfile.wallet_address,
        recipientWalletAddress: requesterProfile.wallet_address,
        amount: String(paymentIntent.amount),
      },
    });
  } catch (settlementError) {
    return NextResponse.json(
      {
        error:
          settlementError instanceof Error
            ? settlementError.message
            : "Could not send the devnet USDC transaction.",
      },
      { status: 502 },
    );
  }

  const timestamp = new Date().toISOString();
  const { data: updatedPaymentIntent, error: updateError } = await supabase
    .from("payment_intents")
    .update({
      status: "settled",
      approval_otp: null,
      approved_at: timestamp,
      approved_by_profile_id: activeProfileId,
      approval_method: approvalMethod,
      transaction_signature: transfer.signature,
      settled_at: timestamp,
    })
    .eq("id", intentId)
    .select(
      "id, sender_profile_id, recipient_profile_id, recipient_phone_number, payer_phone_number, amount, currency, note, status, transaction_signature, approval_method, approved_by_profile_id, created_at, updated_at",
    )
    .single();

  if (updateError || !updatedPaymentIntent) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not verify this OTP." },
      { status: 500 },
    );
  }

  const { error: transactionError } = await supabase.from("transactions").upsert(
    {
      payment_intent_id: intentId,
      signature: transfer.signature,
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
    message:
      approvalMethod === "payer_link"
        ? "OTP verified. Devnet USDC payment settled."
        : "OTP verified. Devnet USDC payment settled from the payer test wallet.",
    data: {
      paymentIntent: updatedPaymentIntent,
      transactionSignature: transfer.signature,
      canSettle: false,
    },
  });
}
