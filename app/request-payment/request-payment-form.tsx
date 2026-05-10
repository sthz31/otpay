"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { ProfileSummary } from "@/lib/supabase/otpay-queries";

type RequestPaymentFormProps = {
  activeProfile: ProfileSummary;
};

type RequestPaymentResponse = {
  ok: boolean;
  message?: string;
  data?: {
      paymentIntent: {
        id: string;
        status: string;
        recipient_phone_number: string;
        payer_phone_number?: string | null;
        amount: number;
        currency: string;
        note: string | null;
      transaction_signature?: string | null;
    };
    senderProfile: {
      id: string;
      display_name: string;
    };
    transactionSignature?: string;
    canSettle?: boolean;
  };
  error?: string;
};

type FormState = {
  recipientPhoneNumber: string;
  amount: string;
  note: string;
};

const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#00e95a_0%,#00c84b_100%)] px-5 text-sm font-extrabold text-[var(--foreground)] shadow-[0_10px_24px_rgba(0,214,79,0.18)] transition hover:brightness-105 hover:shadow-[0_12px_28px_rgba(0,214,79,0.24)] active:translate-y-px active:brightness-95 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-bold text-[var(--foreground)] transition hover:bg-zinc-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

const inputClassName =
  "min-h-13 rounded-2xl border border-black/10 bg-white px-4 py-3 text-base font-normal text-[var(--foreground)] outline-none transition placeholder:text-[rgba(85,112,92,0.72)] focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

export function RequestPaymentForm({ activeProfile }: RequestPaymentFormProps) {
  const { getAccessToken } = usePrivy();
  const [form, setForm] = useState<FormState>({
    recipientPhoneNumber: "",
    amount: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<RequestPaymentResponse["data"] | null>(null);
  const [confirmationOtp, setConfirmationOtp] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const hasPendingConfirmation = Boolean(success && success.paymentIntent.status !== "settled");

  useEffect(() => {
    if (!otpDialogOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOtpDialogOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => otpInputRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [otpDialogOpen]);

  async function buildAuthHeaders() {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      throw new Error("Privy session missing. Please log in again.");
    }

    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(null);

    let response: Response;

    try {
      response = await fetch("/api/payment-intents", {
        method: "POST",
        headers: await buildAuthHeaders(),
        body: JSON.stringify({
          recipientPhoneNumber: form.recipientPhoneNumber,
          amount: form.amount,
          currency: "USDC",
          note: form.note,
        }),
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create this payment request right now.",
      );
      setSubmitting(false);
      return;
    }

    const payload = (await response.json()) as RequestPaymentResponse;

    if (!response.ok || !payload.ok || !payload.data) {
      setError(payload.error ?? "Could not create this payment request right now.");
      setSubmitting(false);
      return;
    }

    setSuccess(payload.data);
    setConfirmationOtp("");
    setOtpDialogOpen(true);
    setSubmitting(false);
    setForm((current) => ({
      ...current,
      recipientPhoneNumber: "",
      amount: "",
      note: "",
    }));
  }

  async function handleConfirmTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!success?.paymentIntent.id) {
      setError("Missing payment intent. Create a request first.");
      return;
    }

    setConfirming(true);
    setError("");

    let response: Response;

    try {
      response = await fetch(`/api/payment-intents/${success.paymentIntent.id}/verify-otp`, {
        method: "POST",
        headers: await buildAuthHeaders(),
        body: JSON.stringify({
          otp: confirmationOtp,
        }),
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not confirm this transaction right now.",
      );
      setConfirming(false);
      return;
    }

    const payload = (await response.json()) as RequestPaymentResponse;

    if (!response.ok || !payload.ok || !payload.data) {
      setError(payload.error ?? "Could not confirm this transaction right now.");
      setConfirming(false);
      return;
    }

    setSuccess(payload.data);
    setConfirming(false);
    setConfirmationOtp("");
    setOtpDialogOpen(false);
  }

  return (
    <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_64px_rgba(8,17,9,0.08)] sm:p-8">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Request flow
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
        Request a payment
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
        Request USDC from a phone number. OTPay sends the payer an OTP and approval
        link, then the payer signs the Solana transfer from their own wallet.
      </p>

      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <div className="rounded-[26px] border border-black/10 bg-[rgba(245,255,244,0.72)] px-5 py-4 text-sm text-[var(--muted)]">
          <p className="font-semibold text-[var(--foreground)]">Sending as</p>
          <p className="mt-2">
            {activeProfile.display_name} ·{" "}
            <span className="font-mono">{activeProfile.phone_number ?? "No phone linked"}</span>
          </p>
          <p className="mt-1 min-w-0 truncate">
            Wallet <span className="font-mono text-xs">{activeProfile.wallet_address}</span>
          </p>
        </div>

        <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">
          Payer phone number
          <input
            className={inputClassName}
            value={form.recipientPhoneNumber}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                recipientPhoneNumber: event.target.value,
              }))
            }
            placeholder="+977 98XXXXXXXX"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            spellCheck={false}
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">
          Amount (USDC)
          <input
            className={inputClassName}
            value={form.amount}
            onChange={(event) =>
              setForm((current) => ({ ...current, amount: event.target.value }))
            }
            placeholder="25"
            type="text"
            inputMode="decimal"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">
          Note
          <textarea
            className={`${inputClassName} min-h-28 resize-none`}
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({ ...current, note: event.target.value }))
            }
            placeholder="April groceries"
            maxLength={160}
          />
        </label>

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className={`${primaryButtonClassName} mt-2 w-full sm:w-fit`}
        >
          {submitting ? "Creating request..." : "Create payment request"}
        </button>
      </form>

      {success ? (
        <div className="mt-8 rounded-[28px] border border-[rgba(0,214,79,0.22)] bg-[var(--accent-soft)] px-5 py-5 text-sm text-[var(--foreground)]">
          <p className="font-semibold">
            {success.paymentIntent.status === "settled"
              ? "Transaction confirmed."
              : "Request created."}
          </p>
          <p className="mt-2">
            Intent <span className="font-mono">{success.paymentIntent.id}</span> is now{" "}
            <span className="font-semibold">{success.paymentIntent.status}</span>.
          </p>
          <p className="mt-1">
            Payer{" "}
            <span className="font-mono">
              {success.paymentIntent.payer_phone_number ??
                success.paymentIntent.recipient_phone_number}
            </span>
          </p>
          {hasPendingConfirmation ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setOtpDialogOpen(true)}
                className={primaryButtonClassName}
              >
                Enter OTP
              </button>
            </div>
          ) : (
            <>
              <p className="mt-2 font-mono text-xs text-lime-900/80">
                Transaction signature:{" "}
                {success.transactionSignature ?? success.paymentIntent.transaction_signature}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/status/${success.paymentIntent.id}`}
                  className={primaryButtonClassName}
                >
                  View request status
                </Link>
                <Link
                  href="/dashboard"
                  className={secondaryButtonClassName}
                >
                  Back to dashboard
                </Link>
              </div>
            </>
          )}
        </div>
      ) : null}

      {success && hasPendingConfirmation && otpDialogOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(5,17,6,0.38)] px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="otp-dialog-title"
          onClick={() => setOtpDialogOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[32px] border border-white/70 bg-[rgba(245,255,244,0.98)] p-5 shadow-[0_28px_90px_rgba(8,17,9,0.22)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  OTP approval
                </p>
                <h2
                  id="otp-dialog-title"
                  className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]"
                >
                  Confirm recipient OTP
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close OTP dialog"
                onClick={() => setOtpDialogOpen(false)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--foreground)] transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              >
                X
              </button>
            </div>

            <div className="mt-5 rounded-[24px] border border-[rgba(0,214,79,0.22)] bg-white/72 px-4 py-4 text-sm text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">Recipient confirmation required</p>
              <p className="mt-2 leading-6">
                OTP was sent to the payer. Entering it here marks the request approved,
                but the payer still needs to open OTPay and sign before settlement.
              </p>
              <p className="mt-2 truncate font-mono text-xs">
                Intent {success.paymentIntent.id}
              </p>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={handleConfirmTransaction}>
              <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">
                Recipient OTP
                <input
                  ref={otpInputRef}
                  className={`${inputClassName} text-center font-mono text-xl tracking-[0.28em]`}
                  value={confirmationOtp}
                  onChange={(event) => setConfirmationOtp(event.target.value)}
                  placeholder="0000"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={4}
                  required
                />
              </label>

              {error ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  type="submit"
                  disabled={confirming}
                  aria-busy={confirming}
                  className={primaryButtonClassName}
                >
                  {confirming ? "Confirming..." : "Confirm with OTP"}
                </button>
                <button
                  type="button"
                  onClick={() => setOtpDialogOpen(false)}
                  className={secondaryButtonClassName}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
