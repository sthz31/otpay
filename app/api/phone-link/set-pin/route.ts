import { NextResponse } from "next/server";
import { hashPin } from "@/lib/auth/pin";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { phoneLinkPinSchema } from "@/lib/validation/payment-intent";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = phoneLinkPinSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid PIN payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: phoneLink, error: phoneLinkError } = await supabase
    .from("phone_links")
    .select("profile_id, is_verified")
    .eq("profile_id", parsed.data.profileId)
    .maybeSingle();

  if (phoneLinkError) {
    return NextResponse.json({ error: phoneLinkError.message }, { status: 500 });
  }

  if (!phoneLink || !phoneLink.is_verified) {
    return NextResponse.json(
      { error: "Verify the phone number before setting a PIN." },
      { status: 403 },
    );
  }

  const pinHash = hashPin(parsed.data.pin);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({
      pin_hash: pinHash,
      pin_set_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.profileId)
    .select("id, display_name, wallet_address, pin_set_at")
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: profileError?.message ?? "Could not save your PIN." },
      { status: 500 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    message: "PIN saved successfully.",
    data: {
      profile,
    },
  });

  response.cookies.set(ACTIVE_PROFILE_COOKIE, profile.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
