"use client";

import Link from "next/link";
import { useState } from "react";
import { getSolscanDevnetTransactionUrl } from "@/lib/solana/explorer";

type ApproveIntentActionsProps = {
  intentId: string;
  initialStatus: string;
  initialApprovalMethod?: "payer_link" | "shared_otp" | null;
};

type ActionResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  data?: {
    transactionSignature?: string;
    paymentIntent?: {
      status: string;
      transaction_signature?: string | null;
    };
  };
};

const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#00e95a_0%,#00c84b_100%)] px-5 text-sm font-extrabold text-[var(--foreground)] shadow-[0_10px_24px_rgba(0,214,79,0.18)] transition hover:brightness-105 hover:shadow-[0_12px_28px_rgba(0,214,79,0.24)] active:translate-y-px active:brightness-95 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-bold text-[var(--foreground)] transition hover:bg-zinc-50 active:translate-y-px disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

export function ApproveIntentActions({
  intentId,
  initialStatus,
  initialApprovalMethod,
}: ApproveIntentActionsProps) {
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState<"pay" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [approvalMethod, setApprovalMethod] = useState(initialApprovalMethod ?? null);
  const [signature, setSignature] = useState<string | null>(null);

  async function readPayload(response: Response) {
    const payload = (await response.json()) as ActionResponse;

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Could not complete this action right now.");
    }

    return payload;
  }

  async function handleConfirmAndPay() {
    setSubmitting("pay");
    setError("");

    try {
      let currentApprovalMethod = approvalMethod;

      if (
        status !== "pending" &&
        (status !== "approved" || currentApprovalMethod !== "payer_link")
      ) {
        throw new Error("Only the payer can confirm the OTP and send this payment.");
      }

      const settleResponse = await fetch(`/api/payment-intents/${intentId}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(status === "pending" ? { otp } : {}),
      });
      const settled = await readPayload(settleResponse);
      const settledStatus = settled.data?.paymentIntent?.status ?? "settled";
      const settledSignature =
        settled.data?.transactionSignature ??
        settled.data?.paymentIntent?.transaction_signature ??
        null;

      if (status === "pending") {
        currentApprovalMethod = "payer_link";
      }

      setStatus(settledStatus);
      setApprovalMethod(currentApprovalMethod);
      setSignature(settledSignature);
      setOtp("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not confirm and pay this request right now.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  async function handleReject() {
    setSubmitting("reject");
    setError("");

    try {
      const response = await fetch(`/api/payment-intents/${intentId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      await readPayload(response);
      setStatus("rejected");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not reject this request right now.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  if (status === "settled" || signature) {
    return (
      <div className="rounded-[28px] border border-lime-200 bg-lime-50 p-6 text-sm text-lime-950">
        <p className="text-lg font-semibold tracking-[-0.03em]">Payment settled on Solana devnet.</p>
        <p className="mt-2 leading-6 text-lime-900">
          The transaction signature is recorded and ready to verify.
        </p>
        {signature ? (
          <a
            href={getSolscanDevnetTransactionUrl(signature)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all font-mono text-xs font-semibold underline decoration-lime-700/40 underline-offset-4 transition hover:text-lime-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2"
          >
            {signature}
          </a>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/status/${intentId}`} className={primaryButtonClassName}>
            View status
          </Link>
          {signature ? (
            <a
              href={getSolscanDevnetTransactionUrl(signature)}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClassName}
            >
              View on Solscan
            </a>
          ) : null}
          <Link href="/dashboard" className={secondaryButtonClassName}>
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 text-sm text-[var(--muted)]">
        <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">Request rejected.</p>
        <p className="mt-2">No funds were moved.</p>
        <div className="mt-5">
          <Link href="/dashboard" className={secondaryButtonClassName}>
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Payment approval</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
        Pay request
      </h2>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Confirm the OTP from the server terminal. OTPay immediately signs and
        sends this devnet USDC payment from the encrypted test wallet.
      </p>

      {status === "pending" ? (
        <label className="mt-5 grid gap-2 text-sm font-semibold text-[var(--foreground)]">
          Payment OTP
          <input
            className="min-h-13 rounded-2xl border border-black/10 bg-white px-4 py-3 text-center font-mono text-xl font-normal tracking-[0.28em] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="0000"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={4}
            required
          />
        </label>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={Boolean(submitting) || (status === "pending" && otp.length !== 4)}
          onClick={handleConfirmAndPay}
          className={primaryButtonClassName}
        >
          {submitting === "pay" ? "Paying..." : "Confirm OTP and pay"}
        </button>
        {status === "pending" ? (
          <button
            type="button"
            disabled={Boolean(submitting)}
            onClick={handleReject}
            className={secondaryButtonClassName}
          >
            {submitting === "reject" ? "Rejecting..." : "Reject request"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
