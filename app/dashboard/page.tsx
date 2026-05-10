import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/auth/session-server";
import {
  getProfileById,
  getRecentPaymentIntents,
} from "@/lib/supabase/otpay-queries";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardPage() {
  const activeProfileCookie = await getActiveProfileId();

  if (!activeProfileCookie) {
    redirect("/login");
  }

  const selectedProfile = await getProfileById(activeProfileCookie);

  if (!selectedProfile) {
    redirect("/login");
  }

  const recentIntents = await getRecentPaymentIntents(selectedProfile.id);
  const outstandingIncoming = recentIntents.filter(
    (intent) => intent.sender_profile_id === selectedProfile.id && intent.status === "pending",
  );

  return (
    <DashboardShell
      profile={selectedProfile}
      recentIntents={recentIntents}
      outstandingIncoming={outstandingIncoming}
    />
  );
}
