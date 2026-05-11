import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { getDevnetWalletBalances } from "@/lib/solana/usdc";
import {
  getProfileById,
  getRecentPaymentIntents,
} from "@/lib/supabase/otpay-queries";

export async function loadDashboardData() {
  const activeProfileCookie = await getActiveProfileId();

  if (!activeProfileCookie) {
    redirect("/login");
  }

  const selectedProfile = await getProfileById(activeProfileCookie);

  if (!selectedProfile) {
    redirect("/login");
  }

  const recentIntents = await getRecentPaymentIntents(selectedProfile.id);
  const balances = await getDevnetWalletBalances(selectedProfile.wallet_address);
  const outstandingIncoming = recentIntents.filter(
    (intent) => intent.sender_profile_id === selectedProfile.id && intent.status === "pending",
  );

  return {
    balances,
    outstandingIncoming,
    recentIntents,
    selectedProfile,
  };
}
