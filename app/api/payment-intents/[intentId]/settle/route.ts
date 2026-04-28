import { NextResponse } from "next/server";
import { prepareUsdcTransfer } from "@/lib/solana/usdc";
import { settlementSchema } from "@/lib/validation/payment-intent";

export async function POST(
  request: Request,
  context: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await context.params;
  const body = await request.json();
  const parsed = settlementSchema.safeParse({
    ...body,
    paymentIntentId: intentId,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settlement payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const transfer = await prepareUsdcTransfer({
    senderWalletAddress: parsed.data.senderWalletAddress,
    recipientWalletAddress: parsed.data.recipientWalletAddress,
    amount: parsed.data.amount,
  });

  return NextResponse.json({
    ok: true,
    message: "Settlement route scaffolded. Sign and send the USDC transfer next.",
    data: {
      intentId,
      status: "settling",
      transfer,
    },
  });
}
