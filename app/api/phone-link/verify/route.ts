import { NextResponse } from "next/server";
import { verifyPhoneOtp } from "@/lib/auth/otp";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { phoneLinkVerifySchema } from "@/lib/validation/payment-intent";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = phoneLinkVerifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid OTP verification payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: phoneLink, error: phoneLinkLookupError } = await supabase
    .from("phone_links")
    .select("id, phone_number, is_verified, profile_id, otp_hash, otp_expires_at")
    .eq("phone_number", parsed.data.phoneNumber)
    .maybeSingle();

  if (phoneLinkLookupError) {
    return NextResponse.json(
      { error: phoneLinkLookupError.message },
      { status: 500 },
    );
  }

  if (!phoneLink) {
    return NextResponse.json(
      { error: "No pending phone registration found for this number." },
      { status: 404 },
    );
  }

  if (
    phoneLink.otp_expires_at &&
    new Date(phoneLink.otp_expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: "This OTP has expired. Start registration again." },
      { status: 401 },
    );
  }

  if (
    !verifyPhoneOtp({
      phoneNumber: phoneLink.phone_number,
      otp: parsed.data.otp,
      otpHash: phoneLink.otp_hash,
    })
  ) {
    return NextResponse.json(
      { error: "Invalid registration OTP. Check the server terminal for the test code." },
      { status: 401 },
    );
  }

  const { data: updatedPhoneLink, error: phoneLinkError } = await supabase
    .from("phone_links")
    .update({ is_verified: true, otp_hash: null, otp_expires_at: null })
    .eq("id", phoneLink.id)
    .select("id, phone_number, is_verified, profile_id")
    .single();

  if (phoneLinkError || !updatedPhoneLink) {
    return NextResponse.json(
      { error: phoneLinkError?.message ?? "Could not verify phone number." },
      { status: 500 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, otpay_tag, wallet_address")
    .eq("id", updatedPhoneLink.profile_id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: profileError?.message ?? "Could not load linked profile." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Phone number verified successfully.",
    data: {
      profile,
      phoneLink: updatedPhoneLink,
    },
  });
}
