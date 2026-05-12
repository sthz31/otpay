import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const activeProfileCookie = await getActiveProfileId();

  if (activeProfileCookie) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <LoginForm />
      <div className="rounded-[32px] border border-black/10 bg-white/70 p-6 text-sm leading-7 text-zinc-600 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
        Test mode uses OTPay phone + PIN auth. No third-party SMS login is required.
      </div>
    </main>
  );
}
