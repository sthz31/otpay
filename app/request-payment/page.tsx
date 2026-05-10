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
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <RequestPaymentForm activeProfile={selectedProfile} />

        <div className="rounded-[32px] border border-black/10 bg-white/70 p-6 text-sm leading-7 text-zinc-600 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
          This request screen uses the authenticated Privy profile from the current
          session, so OTPay always creates requests from the verified phone-linked user.
        </div>
      </div>
    </RequestPaymentShell>
  );
}
