import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { getPaymentIntentById } from "@/lib/supabase/otpay-queries";

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const statusCopy: Record<string, string> = {
  pending: "Waiting for the payer to verify the OTP and approve the request.",
  approved: "Payer approved the request. They still need to sign and send the Solana transfer.",
  rejected: "Payer rejected the request. No funds should move.",
  settling: "Settlement has been prepared and is waiting to be signed and sent.",
  settled: "Settlement completed and this request is finished.",
  failed: "Settlement failed and needs a retry path.",
};

export default async function StatusPage({
  params,
}: {
  params: Promise<{ intentId: string }>;
}) {
  const { intentId } = await params;
  const activeProfileId = await getActiveProfileId();

  if (!activeProfileId) {
    redirect("/login");
  }

  const intent = await getPaymentIntentById(intentId);

  if (!intent) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
        <div className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Status unavailable
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">
            This payment intent could not be found in Supabase.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="primary-dark-button inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (
    intent.sender_profile_id !== activeProfileId &&
    intent.recipient_profile_id !== activeProfileId
  ) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white"
        >
          ← Back to dashboard
        </Link>
        {intent.status === "pending" ? (
          <Link
            href={`/approve/${intent.id}`}
            className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white"
          >
            Approval page
          </Link>
        ) : null}
      </div>

      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
        <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Step 4</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
          Settlement status
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
          This page gives judges the quick proof they need: who requested payment,
          who pays it, who receives it, the approval state, and whether on-chain settlement still
          needs to happen.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Status</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              {intent.status}
            </p>
            <p className="mt-2 text-sm text-zinc-600">{statusCopy[intent.status]}</p>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Amount</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              {formatAmount(intent.amount)} {intent.currency}
            </p>
            <p className="mt-2 text-sm text-zinc-600">Created {formatDate(intent.created_at)}</p>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Transaction proof</p>
            <p className="mt-3 break-all font-mono text-xs text-zinc-950">
              {intent.transaction_signature ?? "Not settled on-chain yet"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Payer</p>
            <p className="mt-3 text-xl font-semibold text-zinc-950">
              {intent.sender_display_name ?? "Unknown sender"}
            </p>
            <p className="mt-2 font-mono text-xs text-zinc-500">
              {intent.payer_phone_number ?? intent.sender_phone_number ?? "No phone"} ·{" "}
              {intent.sender_wallet_address}
            </p>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Requester / Payee</p>
            <p className="mt-3 text-xl font-semibold text-zinc-950">
              {intent.recipient_display_name ?? "Unknown recipient"}
            </p>
            <p className="mt-2 font-mono text-xs text-zinc-500">
              {intent.resolved_recipient_phone_number ?? "No phone"} · {intent.recipient_wallet_address}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-lime-200 bg-lime-50 p-5 text-sm text-lime-950">
          <p className="font-semibold">Next build step</p>
          <p className="mt-2">
            Once a request reaches <span className="font-semibold">approved</span>, the payer signs
            from the approval page and OTPay records the devnet Solana signature here.
          </p>
        </div>
      </section>
    </main>
  );
}
