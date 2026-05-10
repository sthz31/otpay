import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensurePrivySolanaWallet,
  getPrivyPhoneNumber,
  getPrivySolanaWalletAddress,
  getPrivyUserFromRequest,
  type PrivyUserLike,
} from "@/lib/privy/server";

type SyncedProfile = {
  id: string;
  display_name: string;
  wallet_address: string;
  privy_user_id: string | null;
  embedded_wallet_address: string | null;
};

type SyncedPhoneLink = {
  id: string;
  phone_number: string;
  is_verified: boolean;
  profile_id: string;
};

function defaultDisplayName(phoneNumber: string) {
  return `User ${phoneNumber.slice(-4)}`;
}

async function upsertPhoneLinkForProfile(
  profileId: string,
  phoneNumber: string,
  existingPhoneLink?: SyncedPhoneLink | null,
) {
  const supabase = getSupabaseServerClient();

  if (existingPhoneLink) {
    if (
      existingPhoneLink.phone_number === phoneNumber &&
      existingPhoneLink.is_verified
    ) {
      return existingPhoneLink;
    }

    const { data: updatedPhoneLink, error: updatePhoneLinkError } = await supabase
      .from("phone_links")
      .update({
        phone_number: phoneNumber,
        is_verified: true,
      })
      .eq("id", existingPhoneLink.id)
      .select("id, phone_number, is_verified, profile_id")
      .single();

    if (updatePhoneLinkError || !updatedPhoneLink) {
      throw new Error(
        updatePhoneLinkError?.message ?? "Could not update the linked phone number.",
      );
    }

    return updatedPhoneLink as SyncedPhoneLink;
  }

  const { data: createdPhoneLink, error: createPhoneLinkError } = await supabase
    .from("phone_links")
    .insert({
      profile_id: profileId,
      phone_number: phoneNumber,
      is_verified: true,
    })
    .select("id, phone_number, is_verified, profile_id")
    .single();

  if (createPhoneLinkError || !createdPhoneLink) {
    throw new Error(createPhoneLinkError?.message ?? "Could not create the phone link.");
  }

  return createdPhoneLink as SyncedPhoneLink;
}

export async function syncProfileFromPrivyUser(
  privyUser: PrivyUserLike,
  options?: {
    displayName?: string;
  },
) {
  const hydratedPrivyUser = await ensurePrivySolanaWallet(privyUser);
  const phoneNumber = getPrivyPhoneNumber(hydratedPrivyUser)?.trim();

  if (!phoneNumber) {
    throw new Error("No verified phone number was found on this Privy account.");
  }

  const walletAddress = getPrivySolanaWalletAddress(hydratedPrivyUser)?.trim() ?? null;
  const supabase = getSupabaseServerClient();

  const { data: existingPrivyProfile, error: existingPrivyProfileError } = await supabase
    .from("profiles")
    .select(
      "id, display_name, wallet_address, privy_user_id, embedded_wallet_address",
    )
    .eq("privy_user_id", privyUser.id)
    .maybeSingle();

  if (existingPrivyProfileError) {
    throw new Error(existingPrivyProfileError.message);
  }

  if (existingPrivyProfile) {
    const { data: existingPhoneLink, error: existingPhoneLinkError } = await supabase
      .from("phone_links")
      .select("id, phone_number, is_verified, profile_id")
      .eq("profile_id", existingPrivyProfile.id)
      .maybeSingle();

    if (existingPhoneLinkError) {
      throw new Error(existingPhoneLinkError.message);
    }

    const updates: Record<string, string> = {};

    if (walletAddress && existingPrivyProfile.wallet_address !== walletAddress) {
      updates.wallet_address = walletAddress;
      updates.embedded_wallet_address = walletAddress;
    } else if (walletAddress && existingPrivyProfile.embedded_wallet_address !== walletAddress) {
      updates.embedded_wallet_address = walletAddress;
    }

    let profile = existingPrivyProfile as SyncedProfile;

    if (Object.keys(updates).length > 0) {
      const { data: updatedProfile, error: updateProfileError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", existingPrivyProfile.id)
        .select(
          "id, display_name, wallet_address, privy_user_id, embedded_wallet_address",
        )
        .single();

      if (updateProfileError || !updatedProfile) {
        throw new Error(
          updateProfileError?.message ?? "Could not refresh the authenticated profile.",
        );
      }

      profile = updatedProfile as SyncedProfile;
    }

    const phoneLink = await upsertPhoneLinkForProfile(
      profile.id,
      phoneNumber,
      existingPhoneLink as SyncedPhoneLink | null,
    );

    return {
      profile,
      phoneLink,
    };
  }

  const { data: existingPhoneLink, error: existingPhoneLinkError } = await supabase
    .from("phone_links")
    .select("id, phone_number, is_verified, profile_id")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (existingPhoneLinkError) {
    throw new Error(existingPhoneLinkError.message);
  }

  if (existingPhoneLink) {
    const updates: Record<string, string> = {
      privy_user_id: privyUser.id,
    };

    if (walletAddress) {
      updates.wallet_address = walletAddress;
      updates.embedded_wallet_address = walletAddress;
    }

    const { data: linkedProfile, error: linkedProfileError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", existingPhoneLink.profile_id)
      .select(
        "id, display_name, wallet_address, privy_user_id, embedded_wallet_address",
      )
      .single();

    if (linkedProfileError || !linkedProfile) {
      throw new Error(linkedProfileError?.message ?? "Could not link the existing OTPay profile.");
    }

    const phoneLink = await upsertPhoneLinkForProfile(
      linkedProfile.id,
      phoneNumber,
      existingPhoneLink as SyncedPhoneLink,
    );

    return {
      profile: linkedProfile as SyncedProfile,
      phoneLink,
    };
  }

  if (!walletAddress) {
    throw new Error("Privy login succeeded, but no Solana wallet is ready yet.");
  }

  const { data: createdProfile, error: createdProfileError } = await supabase
    .from("profiles")
    .insert({
      display_name: options?.displayName?.trim() || defaultDisplayName(phoneNumber),
      wallet_address: walletAddress,
      privy_user_id: privyUser.id,
      embedded_wallet_address: walletAddress,
    })
    .select(
      "id, display_name, wallet_address, privy_user_id, embedded_wallet_address",
    )
    .single();

  if (createdProfileError || !createdProfile) {
    throw new Error(createdProfileError?.message ?? "Could not create the OTPay profile.");
  }

  const phoneLink = await upsertPhoneLinkForProfile(createdProfile.id, phoneNumber);

  return {
    profile: createdProfile as SyncedProfile,
    phoneLink,
  };
}

export async function getActiveProfileId() {
  try {
    const privyUser = await getPrivyUserFromRequest();

    if (!privyUser) {
      return null;
    }

    const synced = await syncProfileFromPrivyUser(privyUser);
    return synced.profile.id;
  } catch {
    return null;
  }
}
