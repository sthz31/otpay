import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createOtp, hashPaymentOtp } from "@/lib/auth/otp";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { sendPaymentOtpSms } from "@/lib/sms/twilio";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { paymentIntentSchema } from "@/lib/validation/payment-intent";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = paymentIntentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payment intent payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const activeProfileId = await getActiveProfileId();

  if (!activeProfileId) {
    return NextResponse.json({ error: "You must be logged in to create a request." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const amount = Number(parsed.data.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Enter a valid USDC amount greater than zero." },
      { status: 400 },
    );
  }

  const { data: requesterProfile, error: requesterProfileError } = await supabase
    .from("profiles")
    .select("id, display_name, wallet_address")
    .eq("id", activeProfileId)
    .maybeSingle();

  if (requesterProfileError) {
    return NextResponse.json({ error: requesterProfileError.message }, { status: 500 });
  }

  if (!requesterProfile) {
    return NextResponse.json({ error: "Requester profile not found." }, { status: 404 });
  }

  const normalizedPhoneNumber = parsed.data.recipientPhoneNumber.trim();
  const { data: payerPhoneLink, error: payerLookupError } = await supabase
    .from("phone_links")
    .select("profile_id, phone_number, is_verified")
    .eq("phone_number", normalizedPhoneNumber)
    .eq("is_verified", true)
    .maybeSingle();

  if (payerLookupError) {
    return NextResponse.json({ error: payerLookupError.message }, { status: 500 });
  }

  if (!payerPhoneLink) {
    return NextResponse.json(
      { error: "Payer phone number is not registered in OTPay yet." },
      { status: 404 },
    );
  }

  if (payerPhoneLink.profile_id === activeProfileId) {
    return NextResponse.json(
      { error: "Choose a different phone number for the payer." },
      { status: 400 },
    );
  }

  const intentId = randomUUID();
  const approvalOtp = createOtp();
  const approvalUrlBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
  const approvalUrl = `${approvalUrlBase}/approve/${intentId}`;
  const approvalOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: paymentIntent, error: paymentIntentError } = await supabase
    .from("payment_intents")
    .insert({
      id: intentId,
      sender_profile_id: payerPhoneLink.profile_id,
      recipient_profile_id: activeProfileId,
      recipient_phone_number: payerPhoneLink.phone_number,
      payer_phone_number: payerPhoneLink.phone_number,
      amount,
      currency: parsed.data.currency,
      note: parsed.data.note?.trim() || null,
      status: "pending",
      approval_otp: process.env.NODE_ENV === "production" ? null : approvalOtp,
      approval_otp_hash: hashPaymentOtp(intentId, approvalOtp),
      approval_otp_sent_at: new Date().toISOString(),
      approval_otp_expires_at: approvalOtpExpiresAt,
    })
    .select(
      "id, sender_profile_id, recipient_profile_id, recipient_phone_number, payer_phone_number, amount, currency, note, status, transaction_signature, created_at, updated_at",
    )
    .single();

  if (paymentIntentError || !paymentIntent) {
    return NextResponse.json(
      { error: paymentIntentError?.message ?? "Could not create payment intent." },
      { status: 500 },
    );
  }

  try {
    await sendPaymentOtpSms({
      to: payerPhoneLink.phone_number,
      requesterName: requesterProfile.display_name,
      amount: amount.toString(),
      currency: parsed.data.currency,
      otp: approvalOtp,
      approvalUrl,
    });
  } catch (smsError) {
    await supabase.from("payment_intents").delete().eq("id", paymentIntent.id);

    return NextResponse.json(
      {
        error:
          smsError instanceof Error
            ? smsError.message
            : "Could not send the payment OTP. No request was created.",
      },
      { status: 502 },
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[OTPay] Dev OTP ${approvalOtp} sent to ${payerPhoneLink.phone_number} for payment intent ${paymentIntent.id}`,
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Payment intent created successfully.",
    data: {
      paymentIntent,
      senderProfile: requesterProfile,
      approvalUrl,
    },
  });
}
