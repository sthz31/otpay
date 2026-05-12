"use client";

import { useRouter } from "next/navigation";
import { ACTIVE_PROFILE_COOKIE, ACTIVE_PROFILE_STORAGE_KEY } from "@/lib/auth/session";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();

  async function handleLogout() {
    window.localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
    document.cookie = `${ACTIVE_PROFILE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={
        className ??
        "inline-flex w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white"
      }
    >
      Log out
    </button>
  );
}
