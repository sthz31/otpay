import Link from "next/link";
import {
  getProfileById,
  getProfilesForDashboard,
} from "@/lib/supabase/otpay-queries";
import { RequestPaymentForm } from "./request-payment-form";

export default async function RequestPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string }>;
}) {
  const { profileId } = await searchParams;
  const profiles = (await getProfilesForDashboard()).filter(
    (profile) => profile.is_verified && profile.pin_set_at,
  );
  const selectedProfile = await getProfileById(profileId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-wrap gap-3">
        <Link
          href={profileId ? `/dashboard?profileId=${profileId}` : "/dashboard"}
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
        profiles={profiles}
        initialProfileId={selectedProfile?.id ?? profiles[0]?.id ?? null}
      />

      <div className="rounded-[32px] border border-black/10 bg-white/70 p-6 text-sm leading-7 text-zinc-600 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
        This request screen only shows profiles that have finished onboarding with a
        verified phone number and PIN. That keeps the demo dashboard aligned with the
        new login-ready registration flow.
      </div>
    </main>
  );
}
