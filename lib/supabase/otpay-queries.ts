import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ProfileSummary = {
  id: string;
  display_name: string;
  otpay_tag: string | null;
  wallet_address: string;
  privy_user_id: string | null;
  embedded_wallet_address: string | null;
  created_at: string;
  phone_number: string | null;
  is_verified: boolean;
};

export type PaymentIntentSummary = {
  id: string;
  amount: number;
  currency: string;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "settling" | "settled" | "failed";
  transaction_signature: string | null;
  created_at: string;
  sender_profile_id: string;
  recipient_profile_id: string;
  recipient_phone_number: string;
  payer_phone_number: string | null;
  approval_method: "payer_link" | "shared_otp" | null;
  approved_by_profile_id: string | null;
  sender_display_name: string | null;
  sender_wallet_address: string | null;
  sender_phone_number: string | null;
  recipient_display_name: string | null;
  recipient_wallet_address: string | null;
  resolved_recipient_phone_number: string | null;
};

type PaymentIntentQueryRow = {
  id: string;
  amount: number;
  currency: string;
  note: string | null;
  status: PaymentIntentSummary["status"];
  transaction_signature: string | null;
  created_at: string;
  sender_profile_id: string;
  recipient_profile_id: string;
  recipient_phone_number: string;
  payer_phone_number: string | null;
  approval_method: PaymentIntentSummary["approval_method"];
  approved_by_profile_id: string | null;
  sender:
    | {
        display_name: string | null;
        wallet_address: string | null;
      }
    | {
        display_name: string | null;
        wallet_address: string | null;
      }[];
  recipient:
    | {
        display_name: string | null;
        wallet_address: string | null;
      }
    | {
        display_name: string | null;
        wallet_address: string | null;
      }[];
};

export const getProfilesForDashboard = cache(async (): Promise<ProfileSummary[]> => {
  const supabase = getSupabaseServerClient();
  let { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, otpay_tag, wallet_address, privy_user_id, embedded_wallet_address, created_at, phone_links(phone_number, is_verified)",
    )
    .order("created_at", { ascending: true });

  if (error?.message.includes("otpay_tag")) {
    const fallback = await supabase
      .from("profiles")
      .select(
        "id, display_name, wallet_address, privy_user_id, embedded_wallet_address, created_at, phone_links(phone_number, is_verified)",
      )
      .order("created_at", { ascending: true });

    data = fallback.data?.map((profile) => ({ ...profile, otpay_tag: null })) ?? null;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((profile) => {
    const phoneLink = Array.isArray(profile.phone_links)
      ? profile.phone_links[0]
      : profile.phone_links;

    return {
      id: profile.id,
      display_name: profile.display_name,
      otpay_tag: profile.otpay_tag ?? null,
      wallet_address: profile.wallet_address,
      privy_user_id: profile.privy_user_id ?? null,
      embedded_wallet_address: profile.embedded_wallet_address ?? null,
      created_at: profile.created_at,
      phone_number: phoneLink?.phone_number ?? null,
      is_verified: phoneLink?.is_verified ?? false,
    };
  });
});

export const getProfileById = cache(
  async (profileId?: string): Promise<ProfileSummary | null> => {
    if (!profileId) {
      return null;
    }

    const profiles = await getProfilesForDashboard();
    return profiles.find((profile) => profile.id === profileId) ?? null;
  },
);

export async function getRecentPaymentIntents(profileId: string, limit = 8) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_intents")
    .select(
      [
        "id",
        "amount",
        "currency",
        "note",
        "status",
        "transaction_signature",
        "created_at",
        "sender_profile_id",
        "recipient_profile_id",
        "recipient_phone_number",
        "payer_phone_number",
        "approval_method",
        "approved_by_profile_id",
        "sender:profiles!payment_intents_sender_profile_id_fkey(display_name, wallet_address)",
        "recipient:profiles!payment_intents_recipient_profile_id_fkey(display_name, wallet_address)",
      ].join(", "),
    )
    .or(`sender_profile_id.eq.${profileId},recipient_profile_id.eq.${profileId}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as PaymentIntentQueryRow[];

  const profiles = await getProfilesForDashboard();
  const phoneByProfileId = new Map(profiles.map((profile) => [profile.id, profile.phone_number]));

  return rows.map((row) => {
    const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;
    const recipient = Array.isArray(row.recipient) ? row.recipient[0] : row.recipient;

    return {
      ...row,
      sender_display_name: sender?.display_name ?? null,
      sender_wallet_address: sender?.wallet_address ?? null,
      sender_phone_number: phoneByProfileId.get(row.sender_profile_id) ?? null,
      recipient_display_name: recipient?.display_name ?? null,
      recipient_wallet_address: recipient?.wallet_address ?? null,
      resolved_recipient_phone_number: phoneByProfileId.get(row.recipient_profile_id) ?? null,
    } satisfies PaymentIntentSummary;
  });
}

export async function getPaymentIntentById(intentId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_intents")
    .select(
      [
        "id",
        "amount",
        "currency",
        "note",
        "status",
        "transaction_signature",
        "created_at",
        "sender_profile_id",
        "recipient_profile_id",
        "recipient_phone_number",
        "payer_phone_number",
        "approval_method",
        "approved_by_profile_id",
        "sender:profiles!payment_intents_sender_profile_id_fkey(display_name, wallet_address)",
        "recipient:profiles!payment_intents_recipient_profile_id_fkey(display_name, wallet_address)",
      ].join(", "),
    )
    .eq("id", intentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const profiles = await getProfilesForDashboard();
  const phoneByProfileId = new Map(profiles.map((profile) => [profile.id, profile.phone_number]));
  const typedData = data as unknown as PaymentIntentQueryRow;
  const sender = Array.isArray(typedData.sender) ? typedData.sender[0] : typedData.sender;
  const recipient = Array.isArray(typedData.recipient)
    ? typedData.recipient[0]
    : typedData.recipient;

  return {
    ...typedData,
    sender_display_name: sender?.display_name ?? null,
    sender_wallet_address: sender?.wallet_address ?? null,
    sender_phone_number: phoneByProfileId.get(typedData.sender_profile_id) ?? null,
    recipient_display_name: recipient?.display_name ?? null,
    recipient_wallet_address: recipient?.wallet_address ?? null,
    resolved_recipient_phone_number: phoneByProfileId.get(typedData.recipient_profile_id) ?? null,
  } satisfies PaymentIntentSummary;
}
