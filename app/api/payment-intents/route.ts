import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createOtp, hashPaymentOtp } from "@/lib/auth/otp";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { isOtpayTagInput, normalizeOtpayTag } from "@/lib/otpay-tags";
import { sendPaymentOtpSms } from "@/lib/sms/twilio";
import {
  MIN_SOL_FOR_USDC_TRANSFER,
  getDevnetWalletBalances,
} from "@/lib/solana/usdc";
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

  const payerIdentifier = (
    parsed.data.payerIdentifier ??
    parsed.data.recipientPhoneNumber ??
    ""
  ).trim();
  const isPhoneIdentifier = /^\+?[0-9\s\-()]{7,20}$/.test(payerIdentifier);
  const normalizedTag = normalizeOtpayTag(payerIdentifier);

  let payerPhoneLink:
    | { profile_id: string; phone_number: string; is_verified: boolean }
    | null = null;

  if (isPhoneIdentifier) {
    const { data, error: payerLookupError } = await supabase
      .from("phone_links")
      .select("profile_id, phone_number, is_verified")
      .eq("phone_number", payerIdentifier)
      .eq("is_verified", true)
      .maybeSingle();

    if (payerLookupError) {
      return NextResponse.json({ error: payerLookupError.message }, { status: 500 });
    }

    payerPhoneLink = data;
  } else if (isOtpayTagInput(payerIdentifier)) {
    const { data: tagProfile, error: tagProfileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("otpay_tag", normalizedTag)
      .maybeSingle();

    if (tagProfileError) {
      return NextResponse.json({ error: tagProfileError.message }, { status: 500 });
    }

    if (tagProfile) {
      const { data, error: phoneLinkError } = await supabase
        .from("phone_links")
        .select("profile_id, phone_number, is_verified")
        .eq("profile_id", tagProfile.id)
        .eq("is_verified", true)
        .maybeSingle();

      if (phoneLinkError) {
        return NextResponse.json({ error: phoneLinkError.message }, { status: 500 });
      }

      payerPhoneLink = data;
    }
  } else {
    return NextResponse.json(
      { error: "Enter a valid OTPay tag like @freshpayer or a phone number." },
      { status: 400 },
    );
  }

  if (!payerPhoneLink) {
    return NextResponse.json(
      {
        error: isPhoneIdentifier
          ? "Payer phone number is not registered in OTPay yet."
          : `OTPay tag @${normalizedTag} is not registered yet.`,
      },
      { status: 404 },
    );
  }

  if (payerPhoneLink.profile_id === activeProfileId) {
    return NextResponse.json(
      { error: "Choose a different OTPay tag or phone number for the payer." },
      { status: 400 },
    );
  }

  const { data: payerProfile, error: payerProfileError } = await supabase
    .from("profiles")
    .select("id, wallet_address")
    .eq("id", payerPhoneLink.profile_id)
    .maybeSingle();

  if (payerProfileError) {
    return NextResponse.json({ error: payerProfileError.message }, { status: 500 });
  }

  if (!payerProfile?.wallet_address) {
    return NextResponse.json(
      { error: "Payer wallet is missing. Ask the payer to re-register this test account." },
      { status: 409 },
    );
  }

  let payerBalances: Awaited<ReturnType<typeof getDevnetWalletBalances>>;

  try {
    payerBalances = await getDevnetWalletBalances(payerProfile.wallet_address);
  } catch (balanceError) {
    return NextResponse.json(
      {
        error:
          balanceError instanceof Error
            ? `Could not check payer devnet USDC balance: ${balanceError.message}`
            : "Could not check payer devnet USDC balance.",
      },
      { status: 502 },
    );
  }

  const payerUsdcBalance = payerBalances.usdc ?? 0;
  const payerSolBalance = payerBalances.sol ?? 0;

  if (payerUsdcBalance < amount) {
    return NextResponse.json(
      {
        error: `Payer only has ${payerUsdcBalance.toLocaleString(undefined, {
          maximumFractionDigits: 6,
        })} USDC on devnet, but this request needs ${amount.toLocaleString(undefined, {
          maximumFractionDigits: 6,
        })} USDC.`,
        data: {
          payerWalletAddress: payerProfile.wallet_address,
          payerUsdcBalance,
          requestedAmount: amount,
          usdcTokenAccount: payerBalances.usdcAta,
        },
      },
      { status: 409 },
    );
  }

  if (payerSolBalance < MIN_SOL_FOR_USDC_TRANSFER) {
    return NextResponse.json(
      {
        error: `Payer only has ${payerSolBalance.toLocaleString(undefined, {
          maximumFractionDigits: 6,
        })} SOL on devnet. Add at least ${MIN_SOL_FOR_USDC_TRANSFER} devnet SOL to pay transaction fees before creating this request.`,
        data: {
          payerWalletAddress: payerProfile.wallet_address,
          payerSolBalance,
          minimumSolRequired: MIN_SOL_FOR_USDC_TRANSFER,
        },
      },
      { status: 409 },
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
