import { NextResponse } from "next/server";
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

  const supabase = getSupabaseServerClient();
  const amount = Number(parsed.data.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Enter a valid USDC amount greater than zero." },
      { status: 400 },
    );
  }

  const { data: senderProfile, error: senderProfileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", parsed.data.senderProfileId)
    .maybeSingle();

  if (senderProfileError) {
    return NextResponse.json({ error: senderProfileError.message }, { status: 500 });
  }

  if (!senderProfile) {
    return NextResponse.json({ error: "Sender profile not found." }, { status: 404 });
  }

  const normalizedPhoneNumber = parsed.data.recipientPhoneNumber.trim();
  const { data: recipientPhoneLink, error: recipientLookupError } = await supabase
    .from("phone_links")
    .select("profile_id, phone_number, is_verified")
    .eq("phone_number", normalizedPhoneNumber)
    .eq("is_verified", true)
    .maybeSingle();

  if (recipientLookupError) {
    return NextResponse.json({ error: recipientLookupError.message }, { status: 500 });
  }

  if (!recipientPhoneLink) {
    return NextResponse.json(
      { error: "Recipient phone number is not registered in OTPay yet." },
      { status: 404 },
    );
  }

  if (recipientPhoneLink.profile_id === parsed.data.senderProfileId) {
    return NextResponse.json(
      { error: "Choose a different phone number for the recipient." },
      { status: 400 },
    );
  }

  const { data: paymentIntent, error: paymentIntentError } = await supabase
    .from("payment_intents")
    .insert({
      sender_profile_id: parsed.data.senderProfileId,
      recipient_profile_id: recipientPhoneLink.profile_id,
      recipient_phone_number: recipientPhoneLink.phone_number,
      amount,
      currency: parsed.data.currency,
      note: parsed.data.note?.trim() || null,
      status: "pending",
    })
    .select(
      "id, sender_profile_id, recipient_profile_id, recipient_phone_number, amount, currency, note, status, transaction_signature, created_at, updated_at",
    )
    .single();

  if (paymentIntentError || !paymentIntent) {
    return NextResponse.json(
      { error: paymentIntentError?.message ?? "Could not create payment intent." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Payment intent created successfully.",
    data: {
      paymentIntent,
      senderProfile,
    },
  });
}
