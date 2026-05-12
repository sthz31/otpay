import { NextResponse } from "next/server";
import { verifyPin } from "@/lib/auth/pin";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/auth/session";
import { createEncryptedTestWallet } from "@/lib/solana/custodial-wallet";
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
  const phoneNumber = parsed.data.phoneNumber.trim();

  const { data: phoneLink, error: phoneLinkError } = await supabase
    .from("phone_links")
    .select("profile_id, phone_number, is_verified")
    .eq("phone_number", phoneNumber)
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
    .select("id, display_name, wallet_address, encrypted_wallet_secret, pin_hash")
    .eq("id", phoneLink.profile_id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile || !verifyPin(parsed.data.pin, profile.pin_hash)) {
    return NextResponse.json({ error: "Invalid phone number or PIN." }, { status: 401 });
  }

  let activeProfile = profile;

  if (!profile.encrypted_wallet_secret) {
    let testWallet: ReturnType<typeof createEncryptedTestWallet>;

    try {
      testWallet = createEncryptedTestWallet();
    } catch (walletError) {
      return NextResponse.json(
        {
          error:
            walletError instanceof Error
              ? walletError.message
              : "Could not create the test wallet.",
        },
        { status: 500 },
      );
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        wallet_address: testWallet.walletAddress,
        encrypted_wallet_secret: testWallet.encryptedWalletSecret,
      })
      .eq("id", profile.id)
      .select("id, display_name, wallet_address, encrypted_wallet_secret, pin_hash")
      .single();

    if (updateError || !updatedProfile) {
      return NextResponse.json(
        {
          error:
            updateError?.message ??
            "Could not attach a test wallet to this existing profile.",
        },
        { status: 500 },
      );
    }

    activeProfile = updatedProfile;
  }

  const response = NextResponse.json({
    ok: true,
    message: "Logged in successfully.",
    data: {
      profile: {
        id: activeProfile.id,
        display_name: activeProfile.display_name,
        wallet_address: activeProfile.wallet_address,
      },
      phoneLink: {
        phone_number: phoneLink.phone_number,
      },
    },
  });

  response.cookies.set(ACTIVE_PROFILE_COOKIE, activeProfile.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
