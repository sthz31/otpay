import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { PrivyPhoneAuthCard } from "@/app/ui/privy-phone-auth-card";

export default async function LoginPage() {
  const activeProfileCookie = await getActiveProfileId();

  if (activeProfileCookie) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <PrivyPhoneAuthCard mode="login" />
      <div className="rounded-[32px] border border-black/10 bg-white/70 p-6 text-sm leading-7 text-zinc-600 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
        Returning users verify the same phone number with Privy SMS and OTPay restores
        the linked dashboard profile automatically.
      </div>
    </main>
  );
}
