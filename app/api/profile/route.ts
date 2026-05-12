import { NextResponse } from "next/server";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { hashPin, verifyPin } from "@/lib/auth/pin";
import { normalizeOtpayTag } from "@/lib/otpay-tags";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validation/payment-intent";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = profileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile update payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const activeProfileId = await getActiveProfileId();

  if (!activeProfileId) {
    return NextResponse.json({ error: "You must be logged in to update your profile." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, otpay_tag, pin_hash")
    .eq("id", activeProfileId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Active profile not found." }, { status: 404 });
  }

  const updates: {
    display_name?: string;
    otpay_tag?: string;
    pin_hash?: string;
    pin_set_at?: string;
  } = {};

  if (parsed.data.displayName) {
    updates.display_name = parsed.data.displayName;
  }

  if (parsed.data.otpayTag) {
    const nextTag = normalizeOtpayTag(parsed.data.otpayTag);

    if (nextTag !== profile.otpay_tag) {
      const { data: existingTagProfile, error: tagLookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("otpay_tag", nextTag)
        .maybeSingle();

      if (tagLookupError) {
        return NextResponse.json({ error: tagLookupError.message }, { status: 500 });
      }

      if (existingTagProfile && existingTagProfile.id !== activeProfileId) {
        return NextResponse.json({ error: `@${nextTag} is already taken.` }, { status: 409 });
      }

      updates.otpay_tag = nextTag;
    }
  }

  if (parsed.data.newPin) {
    if (!verifyPin(parsed.data.currentPin ?? "", profile.pin_hash)) {
      return NextResponse.json({ error: "Current PIN is incorrect." }, { status: 401 });
    }

    updates.pin_hash = hashPin(parsed.data.newPin);
    updates.pin_set_at = new Date().toISOString();
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ ok: true, message: "No profile changes to save.", data: { profile } });
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", activeProfileId)
    .select("id, display_name, otpay_tag, wallet_address")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Profile updated.",
    data: {
      profile: updatedProfile,
    },
  });
}
