import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Use /verify-otp to approve a payment request." },
    { status: 410 },
  );
}
