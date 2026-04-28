import { NextResponse } from "next/server";
import { verifyPin } from "@/lib/auth/pin";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/payment-intent";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid login payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  const normalizedPhoneNumber = parsed.data.phoneNumber.trim();

  const { data: phoneLink, error: phoneLinkError } = await supabase
    .from("phone_links")
    .select("profile_id, phone_number, is_verified")
    .eq("phone_number", normalizedPhoneNumber)
    .eq("is_verified", true)
    .maybeSingle();

  if (phoneLinkError) {
    return NextResponse.json({ error: phoneLinkError.message }, { status: 500 });
  }

  if (!phoneLink) {
    return NextResponse.json(
      { error: "No verified OTPay account found for this phone number." },
      { status: 404 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, wallet_address, pin_hash, pin_set_at")
    .eq("id", phoneLink.profile_id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile || !profile.pin_set_at) {
    return NextResponse.json(
      { error: "This account has not finished PIN setup yet." },
      { status: 403 },
    );
  }

  if (!verifyPin(parsed.data.pin, profile.pin_hash)) {
    return NextResponse.json(
      { error: "Incorrect phone number or PIN." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    message: "Logged in successfully.",
    data: {
      profile: {
        id: profile.id,
        display_name: profile.display_name,
        wallet_address: profile.wallet_address,
      },
      phoneLink: {
        phone_number: phoneLink.phone_number,
      },
    },
  });

  response.cookies.set(ACTIVE_PROFILE_COOKIE, profile.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  return response;
}
