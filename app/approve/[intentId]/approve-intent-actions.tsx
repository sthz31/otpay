"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";

type ApproveIntentActionsProps = {
  intentId: string;
  payerWalletAddress: string | null;
  initialStatus: string;
  initialApprovalMethod?: "payer_link" | "shared_otp" | null;
};

type ActionResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  data?: {
    canSettle?: boolean;
    transactionSignature?: string;
    transfer?: {
      transaction: string;
    };
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

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function encodeBase58(bytes: Uint8Array) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = [0];

  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  for (const byte of bytes) {
    if (byte !== 0) break;
    digits.push(0);
  }

  return digits
    .reverse()
    .map((digit) => alphabet[digit])
    .join("");
}

export function ApproveIntentActions({
  intentId,
  payerWalletAddress,
  initialStatus,
  initialApprovalMethod,
}: ApproveIntentActionsProps) {
  const { getAccessToken } = usePrivy();
  const { wallets, ready } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState<"verify" | "reject" | "settle" | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [approvalMethod, setApprovalMethod] = useState(initialApprovalMethod ?? null);
  const [signature, setSignature] = useState<string | null>(null);

  const canSettle = status === "approved" && approvalMethod === "payer_link";

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

  async function readPayload(response: Response) {
    const payload = (await response.json()) as ActionResponse;

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Could not complete this action right now.");
    }

    return payload;
  }

  async function handleVerifyOtp() {
    setSubmitting("verify");
    setError("");

    try {
      const response = await fetch(`/api/payment-intents/${intentId}/verify-otp`, {
        method: "POST",
        headers: await buildAuthHeaders(),
        body: JSON.stringify({ otp }),
      });
      const payload = await readPayload(response);
      setStatus(payload.data?.paymentIntent?.status ?? "approved");
      setApprovalMethod("payer_link");
      setOtp("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not verify this OTP right now.",
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
        headers: await buildAuthHeaders(),
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

  async function handleSignAndSend() {
    setSubmitting("settle");
    setError("");

    try {
      if (!ready) {
        throw new Error("Your Solana wallet is still loading.");
      }

      const wallet = wallets.find((candidate) => candidate.address === payerWalletAddress);

      if (!wallet) {
        throw new Error("Open OTPay with the payer wallet to sign this transfer.");
      }

      const prepareResponse = await fetch(`/api/payment-intents/${intentId}/settle`, {
        method: "POST",
        headers: await buildAuthHeaders(),
        body: JSON.stringify({}),
      });
      const prepared = await readPayload(prepareResponse);
      const transaction = prepared.data?.transfer?.transaction;

      if (!transaction) {
        throw new Error("The server did not return a transaction to sign.");
      }

      const signed = await signAndSendTransaction({
        wallet,
        chain: "solana:devnet",
        transaction: base64ToBytes(transaction),
      });
      const transactionSignature = encodeBase58(signed.signature);
      const recordResponse = await fetch(`/api/payment-intents/${intentId}/settle`, {
        method: "POST",
        headers: await buildAuthHeaders(),
        body: JSON.stringify({ signature: transactionSignature }),
      });
      const recorded = await readPayload(recordResponse);

      setStatus(recorded.data?.paymentIntent?.status ?? "settled");
      setSignature(recorded.data?.transactionSignature ?? transactionSignature);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not sign and send this transfer right now.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  if (status === "settled" || signature) {
    return (
      <div className="rounded-[28px] border border-lime-200 bg-lime-50 p-6 text-sm text-lime-950">
        <p className="font-semibold">Payment settled on Solana.</p>
        <p className="mt-2 break-all font-mono text-xs">{signature}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/status/${intentId}`} className={primaryButtonClassName}>
            View status
          </Link>
          <Link href="/dashboard" className={secondaryButtonClassName}>
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 text-sm text-zinc-700">
        <p className="font-semibold text-zinc-950">Request rejected.</p>
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
    <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
      <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Payment approval</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
        Pay request
      </h2>
      <p className="mt-3 text-sm leading-6 text-zinc-600">
        Confirm the OTP sent to your phone, then sign and send the USDC transfer from
        your Solana wallet. OTPay never handles your private key.
      </p>

      {status === "pending" ? (
        <label className="mt-5 grid gap-2 text-sm font-semibold text-zinc-900">
          Payment OTP
          <input
            className="min-h-13 rounded-2xl border border-black/10 bg-white px-4 py-3 text-center font-mono text-xl font-normal tracking-[0.28em] text-zinc-900 outline-none transition focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
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
        {status === "pending" ? (
          <button
            type="button"
            disabled={Boolean(submitting) || otp.length !== 4}
            onClick={handleVerifyOtp}
            className={primaryButtonClassName}
          >
            {submitting === "verify" ? "Verifying..." : "Confirm OTP"}
          </button>
        ) : null}
        {canSettle ? (
          <button
            type="button"
            disabled={Boolean(submitting)}
            onClick={handleSignAndSend}
            className={primaryButtonClassName}
          >
            {submitting === "settle" ? "Signing..." : "Sign and send"}
          </button>
        ) : null}
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
