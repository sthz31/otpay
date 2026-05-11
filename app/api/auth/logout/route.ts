import { NextResponse } from "next/server";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({
    ok: true,
    message: "Logged out successfully.",
  });

  response.cookies.set(ACTIVE_PROFILE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
