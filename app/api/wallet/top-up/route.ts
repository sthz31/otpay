import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveProfileId } from "@/lib/auth/session-server";
import {
  DEMO_TOP_UP_SOL_AMOUNT,
  airdropDevnetSol,
  getDevnetWalletBalances,
  sendTreasuryUsdcTopUp,
} from "@/lib/solana/usdc";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const topUpSchema = z.object({
  usdcAmount: z.union([z.literal(10), z.literal(25), z.literal(50)]),
});

const DAILY_USDC_LIMIT = 100;

function getUtcDayStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = topUpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Choose a valid demo top-up amount.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const activeProfileId = await getActiveProfileId();

  if (!activeProfileId) {
    return NextResponse.json({ error: "You must be logged in to load funds." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, wallet_address")
    .eq("id", activeProfileId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile?.wallet_address) {
    return NextResponse.json({ error: "Active wallet profile not found." }, { status: 404 });
  }

  const dayStart = getUtcDayStart().toISOString();
  const { data: todaysEvents, error: limitError } = await supabase
    .from("funding_events")
    .select("usdc_amount")
    .eq("profile_id", activeProfileId)
    .eq("status", "confirmed")
    .gte("created_at", dayStart);

  if (limitError) {
    return NextResponse.json({ error: limitError.message }, { status: 500 });
  }

  const todaysTotal = (todaysEvents ?? []).reduce(
    (sum, event) => sum + Number(event.usdc_amount),
    0,
  );

  if (todaysTotal + parsed.data.usdcAmount > DAILY_USDC_LIMIT) {
    return NextResponse.json(
      {
        error: `Demo card top-ups are limited to ${DAILY_USDC_LIMIT} USDC per wallet per UTC day. You have ${Math.max(
          0,
          DAILY_USDC_LIMIT - todaysTotal,
        )} USDC remaining today.`,
      },
      { status: 429 },
    );
  }

  const { data: fundingEvent, error: createEventError } = await supabase
    .from("funding_events")
    .insert({
      profile_id: activeProfileId,
      wallet_address: profile.wallet_address,
      usdc_amount: parsed.data.usdcAmount,
      sol_amount: DEMO_TOP_UP_SOL_AMOUNT,
      status: "pending",
    })
    .select("id")
    .single();

  if (createEventError || !fundingEvent) {
    return NextResponse.json(
      { error: createEventError?.message ?? "Could not start demo top-up." },
      { status: 500 },
    );
  }

  let solSignature: string | null = null;
  let usdcSignature: string | null = null;
  let solError: string | null = null;

  try {
    try {
      solSignature = await airdropDevnetSol({
        walletAddress: profile.wallet_address,
        solAmount: DEMO_TOP_UP_SOL_AMOUNT,
      });
    } catch (airdropError) {
      solError =
        airdropError instanceof Error
          ? airdropError.message
          : "Devnet faucet is temporarily unavailable.";
      console.warn(
        `[OTPay demo top-up] SOL airdrop to ${profile.wallet_address} failed: ${solError}`,
      );
    }

    const usdcTransfer = await sendTreasuryUsdcTopUp({
      recipientWalletAddress: profile.wallet_address,
      amount: parsed.data.usdcAmount,
    });
    usdcSignature = usdcTransfer.signature;

    const balances = await getDevnetWalletBalances(profile.wallet_address);

    const { error: updateEventError } = await supabase
      .from("funding_events")
      .update({
        sol_signature: solSignature,
        usdc_signature: usdcSignature,
        status: "confirmed",
        sol_amount: solSignature ? DEMO_TOP_UP_SOL_AMOUNT : 0,
        error_message: solError,
      })
      .eq("id", fundingEvent.id);

    if (updateEventError) {
      return NextResponse.json({ error: updateEventError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Demo funds loaded.",
      data: {
        balances,
        fundingEventId: fundingEvent.id,
        solAmount: DEMO_TOP_UP_SOL_AMOUNT,
        usdcAmount: parsed.data.usdcAmount,
        solError,
        solSignature,
        usdcSignature,
      },
    });
  } catch (topUpError) {
    const message =
      topUpError instanceof Error ? topUpError.message : "Could not load demo funds.";

    await supabase
      .from("funding_events")
      .update({
        sol_signature: solSignature,
        usdc_signature: usdcSignature,
        status: "failed",
        error_message: message,
      })
      .eq("id", fundingEvent.id);

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
