import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/auth/session-server";
import {
  getProfileById,
} from "@/lib/supabase/otpay-queries";
import { RequestPaymentForm } from "./request-payment-form";
import { RequestPaymentShell } from "./request-payment-shell";

export default async function RequestPaymentPage() {
  const activeProfileId = await getActiveProfileId();

  if (!activeProfileId) {
    redirect("/login");
  }

  const selectedProfile = await getProfileById(activeProfileId);

  if (!selectedProfile || !selectedProfile.is_verified) {
    redirect("/login");
  }

  return (
    <RequestPaymentShell activeProfile={selectedProfile}>
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <RequestPaymentForm activeProfile={selectedProfile} />
      </div>
    </RequestPaymentShell>
  );
}
