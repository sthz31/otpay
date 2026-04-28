import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/auth/session-server";
import {
  getProfileById,
} from "@/lib/supabase/otpay-queries";
import { RequestPaymentForm } from "./request-payment-form";

export default async function RequestPaymentPage() {
  const activeProfileId = await getActiveProfileId();

  if (!activeProfileId) {
    redirect("/login");
  }

  const selectedProfile = await getProfileById(activeProfileId);

  if (!selectedProfile || !selectedProfile.is_verified || !selectedProfile.pin_set_at) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white"
        >
          ← Back to dashboard
        </Link>
        <Link
          href="/"
          className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white"
        >
          Landing page
        </Link>
      </div>

      <RequestPaymentForm
        activeProfile={selectedProfile}
      />

      <div className="rounded-[32px] border border-black/10 bg-white/70 p-6 text-sm leading-7 text-zinc-600 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
        This request screen uses the logged-in profile from the current session. That
        keeps request creation aligned with the new login-ready registration flow.
      </div>
    </main>
  );
}
