import { NextResponse } from "next/server";
import { createOtp, hashPhoneOtp } from "@/lib/auth/otp";
import { createEncryptedTestWallet } from "@/lib/solana/custodial-wallet";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { phoneLinkStartSchema } from "@/lib/validation/payment-intent";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = phoneLinkStartSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid phone link payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  const normalizedPhoneNumber = parsed.data.phoneNumber.trim();
  const otp = createOtp();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: existingPhoneLink, error: existingPhoneLinkError } = await supabase
    .from("phone_links")
    .select("id, is_verified")
    .eq("phone_number", normalizedPhoneNumber)
    .maybeSingle();

  if (existingPhoneLinkError) {
    return NextResponse.json(
      { error: existingPhoneLinkError.message },
      { status: 500 },
    );
  }

  if (existingPhoneLink?.is_verified) {
    return NextResponse.json(
      { error: "This phone number is already registered." },
      { status: 409 },
    );
  }

  if (existingPhoneLink && !existingPhoneLink.is_verified) {
    const { error: otpUpdateError } = await supabase
      .from("phone_links")
      .update({
        otp_hash: hashPhoneOtp(normalizedPhoneNumber, otp),
        otp_expires_at: otpExpiresAt,
      })
      .eq("id", existingPhoneLink.id);

    if (otpUpdateError) {
      return NextResponse.json({ error: otpUpdateError.message }, { status: 500 });
    }

    const { data: existingPendingLink, error: existingPendingLinkError } = await supabase
      .from("phone_links")
      .select("id, phone_number, is_verified, profile_id")
      .eq("id", existingPhoneLink.id)
      .single();

    if (existingPendingLinkError || !existingPendingLink) {
      return NextResponse.json(
        {
          error:
            existingPendingLinkError?.message ??
            "Could not resume the pending phone registration.",
        },
        { status: 500 },
      );
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("id, display_name, wallet_address, encrypted_wallet_secret")
      .eq("id", existingPendingLink.profile_id)
      .single();

    if (existingProfileError || !existingProfile) {
      return NextResponse.json(
        {
          error:
            existingProfileError?.message ??
            "Could not load the pending profile for this phone number.",
        },
        { status: 500 },
      );
    }

    let pendingProfile = existingProfile;

    if (!existingProfile.encrypted_wallet_secret) {
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
        .eq("id", existingProfile.id)
        .select("id, display_name, wallet_address, encrypted_wallet_secret")
        .single();

      if (updateError || !updatedProfile) {
        return NextResponse.json(
          {
            error:
              updateError?.message ??
              "Could not attach a test wallet to the pending profile.",
          },
          { status: 500 },
        );
      }

      pendingProfile = updatedProfile;
    }

    console.log(
      `[OTPay test auth] Registration OTP ${otp} for ${normalizedPhoneNumber} expires at ${otpExpiresAt}`,
    );

    return NextResponse.json({
      ok: true,
      message: "Pending registration found. Continue with OTP verification.",
      data: {
        profile: {
          id: pendingProfile.id,
          display_name: pendingProfile.display_name,
          wallet_address: pendingProfile.wallet_address,
        },
        phoneLink: existingPendingLink,
      },
    });
  }

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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      display_name: parsed.data.displayName.trim(),
      wallet_address: testWallet.walletAddress,
      encrypted_wallet_secret: testWallet.encryptedWalletSecret,
    })
    .select("id, display_name, wallet_address")
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: profileError?.message ?? "Could not create profile." },
      { status: 500 },
    );
  }

  const { data: phoneLink, error: phoneLinkError } = await supabase
    .from("phone_links")
    .insert({
      profile_id: profile.id,
      phone_number: normalizedPhoneNumber,
      is_verified: false,
      otp_hash: hashPhoneOtp(normalizedPhoneNumber, otp),
      otp_expires_at: otpExpiresAt,
    })
    .select("id, phone_number, is_verified")
    .single();

  if (phoneLinkError || !phoneLink) {
    await supabase.from("profiles").delete().eq("id", profile.id);

    return NextResponse.json(
      { error: phoneLinkError?.message ?? "Could not create phone link." },
      { status: 500 },
    );
  }

  console.log(
    `[OTPay test auth] Registration OTP ${otp} for ${normalizedPhoneNumber} expires at ${otpExpiresAt}`,
  );

  return NextResponse.json({
    ok: true,
    message: "Phone number created. Verify OTP next.",
    data: {
      profile,
      phoneLink,
    },
  });
}
