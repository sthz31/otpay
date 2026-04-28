import { NextResponse } from "next/server";
import { Keypair } from "@solana/web3.js";
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
      .select("id, display_name, wallet_address")
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

    return NextResponse.json({
      ok: true,
      message: "Pending registration found. Continue with OTP verification.",
      data: {
        profile: existingProfile,
        phoneLink: existingPendingLink,
      },
    });
  }

  const generatedWalletAddress = Keypair.generate().publicKey.toBase58();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      display_name: parsed.data.displayName.trim(),
      wallet_address: generatedWalletAddress,
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

  return NextResponse.json({
    ok: true,
    message: "Phone number created. Verify OTP next.",
    data: {
      profile,
      phoneLink,
    },
  });
}
