import { cookies } from "next/headers";
import { ACTIVE_PROFILE_COOKIE } from "./session";

export async function getActiveProfileId() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value ?? null;
}
