import Link from "next/link";
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

export default async function ApproveIntentPage({
  params,
}: {
  params: Promise<{ intentId: string }>;
}) {
  const { intentId } = await params;
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
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/dashboard?profileId=${intent.recipient_profile_id}`}
          className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white"
        >
          ← Back to dashboard
        </Link>
        <Link
          href={`/status/${intent.id}`}
          className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white"
        >
          Status page
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
          <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Approval</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
            Review payment request
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            The recipient sees who asked for payment, why, and for how much before
            deciding whether to approve or reject the request.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Sender</p>
              <p className="mt-3 text-xl font-semibold text-zinc-950">
                {intent.sender_display_name ?? "Unknown sender"}
              </p>
              <p className="mt-2 font-mono text-xs text-zinc-500">
                {intent.sender_phone_number ?? "No phone"} · {intent.sender_wallet_address}
              </p>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Recipient</p>
              <p className="mt-3 text-xl font-semibold text-zinc-950">
                {intent.recipient_display_name ?? "Unknown recipient"}
              </p>
              <p className="mt-2 font-mono text-xs text-zinc-500">
                {intent.resolved_recipient_phone_number ?? intent.recipient_phone_number} ·{" "}
                {intent.recipient_wallet_address}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-zinc-200 bg-zinc-50 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Requested amount</p>
                <p className="mt-3 text-5xl font-semibold tracking-tight text-zinc-950">
                  {formatAmount(intent.amount)} {intent.currency}
                </p>
              </div>
              <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900">
                {intent.status}
              </div>
            </div>

            <p className="mt-4 text-sm text-zinc-600">Created {formatDate(intent.created_at)}</p>
            {intent.note ? (
              <p className="mt-4 text-base leading-7 text-zinc-700">“{intent.note}”</p>
            ) : (
              <p className="mt-4 text-base leading-7 text-zinc-500">No note was included.</p>
            )}
          </div>
        </div>

        {intent.status === "pending" ? (
          <ApproveIntentActions
            intentId={intent.id}
            recipientProfileId={intent.recipient_profile_id}
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
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
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
