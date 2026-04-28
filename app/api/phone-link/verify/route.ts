import { NextResponse } from "next/server";
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

  if (parsed.data.otp !== "6789") {
    return NextResponse.json(
      { error: "Invalid demo OTP. Use 6789 for the current hackathon build." },
      { status: 401 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: phoneLink, error: phoneLinkLookupError } = await supabase
    .from("phone_links")
    .select("id, phone_number, is_verified, profile_id")
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

  const { data: updatedPhoneLink, error: phoneLinkError } = await supabase
    .from("phone_links")
    .update({ is_verified: true })
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
    .select("id, display_name, wallet_address")
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
