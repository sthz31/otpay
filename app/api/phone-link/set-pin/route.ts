import { randomBytes, scryptSync } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { phoneLinkPinSchema } from "@/lib/validation/payment-intent";

function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(pin, salt, 64).toString("hex");

  return `${salt}:${derivedKey}`;
}

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

  return NextResponse.json({
    ok: true,
    message: "PIN saved successfully.",
    data: {
      profile,
    },
  });
}
