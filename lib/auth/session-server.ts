import { cookies } from "next/headers";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getActiveProfileId() {
  const cookieStore = await cookies();
  const profileId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;

  if (!profileId) {
    return null;
  }

  const supabase = getSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  return profile.id as string;
}
