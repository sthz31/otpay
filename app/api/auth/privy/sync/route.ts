import { NextResponse } from "next/server";
import { syncProfileFromPrivyUser } from "@/lib/auth/session-server";
import {
  getPrivyAccessTokenFromRequest,
  getPrivyUserFromRequest,
} from "@/lib/privy/server";

export async function POST(request: Request) {
  try {
    const privyUser = await getPrivyUserFromRequest();

    if (!privyUser) {
      return NextResponse.json(
        { error: "Privy session not found. Log in again and retry." },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      displayName?: string;
    };

    const { profile, phoneLink } = await syncProfileFromPrivyUser(privyUser, {
      displayName: body.displayName,
    });

    const response = NextResponse.json({
      ok: true,
      message: "Privy account linked successfully.",
      data: {
        profile,
        phoneLink,
      },
    });

    const accessToken = await getPrivyAccessTokenFromRequest();

    if (accessToken) {
      response.cookies.set("privy-token", accessToken, {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not link this Privy account.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: message.includes("wallet") ? 409 : 500,
      },
    );
  }
}
