import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { getSolscanDevnetTransactionUrl } from "@/lib/solana/explorer";
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

function truncateAddress(value?: string | null) {
  if (!value) return "No wallet";
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

const pillLinkClassName =
  "inline-flex min-h-10 w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#00e95a_0%,#00c84b_100%)] px-5 text-sm font-extrabold text-[var(--foreground)] shadow-[0_10px_24px_rgba(0,214,79,0.18)] transition hover:brightness-105 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

const statusCopy: Record<string, string> = {
  pending: "Waiting for OTP confirmation.",
  approved: "OTP was approved, but no transaction signature is recorded yet.",
  rejected: "Payer rejected the request. No funds should move.",
  settling: "Settlement is in progress.",
  settled: "Payment settled on Solana devnet.",
  failed: "Settlement failed. Try again or create a new request.",
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
              className={primaryButtonClassName}
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className={pillLinkClassName}>
          Back to wallet
        </Link>
        {intent.status === "pending" ? (
          <Link href={`/approve/${intent.id}`} className={pillLinkClassName}>
            Approval page
          </Link>
        ) : null}
      </div>

      <section className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_64px_rgba(8,17,9,0.08)] sm:p-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Payment status</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
          {intent.status === "settled" ? "Payment complete" : "Payment pending"}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Track the request, payer, payee, and devnet transaction proof.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-black/10 bg-[rgba(245,255,244,0.72)] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Status</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
              {intent.status}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">{statusCopy[intent.status]}</p>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-[rgba(245,255,244,0.72)] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Amount</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
              {formatAmount(intent.amount)} {intent.currency}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">Created {formatDate(intent.created_at)}</p>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-[rgba(245,255,244,0.72)] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Transaction proof</p>
            {intent.transaction_signature ? (
              <>
                <a
                  href={getSolscanDevnetTransactionUrl(intent.transaction_signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block break-all font-mono text-xs font-semibold text-[var(--foreground)] underline decoration-lime-500/50 underline-offset-4 transition hover:text-lime-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2"
                >
                  {intent.transaction_signature}
                </a>
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                  Open devnet transaction on Solscan
                </p>
              </>
            ) : (
              <p className="mt-3 break-all font-mono text-xs text-[var(--foreground)]">
                No devnet transaction yet
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="min-w-0 rounded-[28px] border border-black/10 bg-[rgba(245,255,244,0.72)] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Payer</p>
            <p className="mt-3 truncate text-xl font-semibold text-[var(--foreground)]">
              {intent.sender_display_name ?? "Unknown sender"}
            </p>
            <p className="mt-2 truncate font-mono text-xs text-[var(--muted)]">
              {intent.payer_phone_number ?? intent.sender_phone_number ?? "No phone"}
            </p>
            <p className="mt-1 truncate font-mono text-xs text-[var(--muted)]">
              {truncateAddress(intent.sender_wallet_address)}
            </p>
          </div>

          <div className="min-w-0 rounded-[28px] border border-black/10 bg-[rgba(245,255,244,0.72)] p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Requester / Payee</p>
            <p className="mt-3 truncate text-xl font-semibold text-[var(--foreground)]">
              {intent.recipient_display_name ?? "Unknown recipient"}
            </p>
            <p className="mt-2 truncate font-mono text-xs text-[var(--muted)]">
              {intent.resolved_recipient_phone_number ?? "No phone"}
            </p>
            <p className="mt-1 truncate font-mono text-xs text-[var(--muted)]">
              {truncateAddress(intent.recipient_wallet_address)}
            </p>
          </div>
        </div>

        {intent.status !== "settled" ? (
          <div className="mt-6 rounded-[28px] border border-lime-200 bg-lime-50 p-5 text-sm text-lime-950">
            <p className="font-semibold">Next step</p>
            <p className="mt-2">
              Enter the request OTP to send devnet USDC and record the transaction signature.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
