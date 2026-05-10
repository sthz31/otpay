import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    {
      error: "PIN login has been retired. Use Privy SMS login instead.",
    },
    { status: 410 },
  );
}
