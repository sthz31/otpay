import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/auth/session-server";
import { getPaymentIntentById } from "@/lib/supabase/otpay-queries";
import { ApproveIntentActions } from "./approve-intent-actions";

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

export default async function ApproveIntentPage({
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
            Request not found
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">
            This payment intent does not exist yet or was removed from the demo data.
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

  if (intent.sender_profile_id !== activeProfileId) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className={pillLinkClassName}>
          Back to wallet
        </Link>
        <Link href={`/status/${intent.id}`} className={pillLinkClassName}>
          Status page
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_64px_rgba(8,17,9,0.08)] sm:p-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Approval</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
            Pay request
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Review who requested payment, confirm the OTP from the server terminal,
            then OTPay signs and sends devnet USDC from the encrypted test wallet.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
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
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Requester</p>
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

          <div className="mt-6 rounded-[28px] border border-black/10 bg-[rgba(245,255,244,0.72)] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Requested amount</p>
                <p className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)]">
                  {formatAmount(intent.amount)} {intent.currency}
                </p>
              </div>
              <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[var(--foreground)]">
                {intent.status}
              </div>
            </div>

            <p className="mt-4 text-sm text-[var(--muted)]">Created {formatDate(intent.created_at)}</p>
            {intent.note ? (
              <p className="mt-4 text-base leading-7 text-[var(--foreground)]">&quot;{intent.note}&quot;</p>
            ) : (
              <p className="mt-4 text-base leading-7 text-[var(--muted)]">No note was included.</p>
            )}
          </div>
        </div>

        {intent.status === "pending" || intent.status === "approved" ? (
          <ApproveIntentActions
            initialApprovalMethod={intent.approval_method}
            initialStatus={intent.status}
            intentId={intent.id}
          />
        ) : (
          <div className="rounded-[28px] border border-lime-200 bg-lime-50 p-6 text-sm text-lime-950">
            <p className="font-semibold">This request is already {intent.status}.</p>
            <p className="mt-2">
              Approval is no longer needed here. Continue to the status page for the
              latest settlement state.
            </p>
            <div className="mt-5">
              <Link
                href={`/status/${intent.id}`}
                className={primaryButtonClassName}
              >
                Open status page
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
