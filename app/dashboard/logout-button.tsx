"use client";

import { useRouter } from "next/navigation";
import { ACTIVE_PROFILE_COOKIE, ACTIVE_PROFILE_STORAGE_KEY } from "@/lib/auth/session";

export function LogoutButton() {
  const router = useRouter();

  function handleLogout() {
    window.localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
    document.cookie = `${ACTIVE_PROFILE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white"
    >
      Log out
    </button>
  );
}
