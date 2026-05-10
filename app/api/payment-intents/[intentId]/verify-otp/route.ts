import { NextResponse } from "next/server";
import { verifyPaymentOtp } from "@/lib/auth/otp";
import { getActiveProfileId } from "@/lib/auth/session-server";
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
      "id, status, approval_otp_hash, approval_otp_expires_at, sender_profile_id, recipient_profile_id, approval_method, approved_by_profile_id",
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
    return NextResponse.json({ error: "This payment request is already settled." }, { status: 409 });
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

  if (paymentIntent.status === "approved" && paymentIntent.approval_method === "payer_link") {
    if (paymentIntent.sender_profile_id !== activeProfileId) {
      return NextResponse.json(
        { error: "The payer has already approved this request for settlement." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "OTP already verified. Sign and send the USDC transfer next.",
      data: {
        paymentIntent,
        canSettle: true,
      },
    });
  }

  const { data: updatedPaymentIntent, error: updateError } = await supabase
    .from("payment_intents")
    .update({
      status: "approved",
      approval_otp: null,
      approved_at: new Date().toISOString(),
      approved_by_profile_id: activeProfileId,
      approval_method: approvalMethod,
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

  return NextResponse.json({
    ok: true,
    message:
      approvalMethod === "payer_link"
        ? "OTP verified. Sign and send the USDC transfer next."
        : "OTP verified. The payer still needs to open OTPay and sign before settlement.",
    data: {
      paymentIntent: updatedPaymentIntent,
      canSettle: approvalMethod === "payer_link",
    },
  });
}
