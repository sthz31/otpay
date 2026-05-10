import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { PrivyPhoneAuthCard } from "@/app/ui/privy-phone-auth-card";

export default async function LinkPhonePage() {
  const activeProfileId = await getActiveProfileId();

  if (activeProfileId) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white"
        >
          ← Back to landing
        </Link>
        <Link
          href="/login"
          className="primary-dark-button inline-flex w-fit items-center rounded-full px-4 py-2 text-sm font-semibold transition"
        >
          Log in to dashboard
        </Link>
      </div>
      <PrivyPhoneAuthCard mode="register" />
      <div className="rounded-[32px] border border-black/10 bg-white/70 p-6 text-sm leading-7 text-zinc-600 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
        OTPay now uses Privy for SMS verification and Solana wallet provisioning.
        Existing users are matched back to their OTPay profile by phone number.
      </div>
    </main>
  );
}
