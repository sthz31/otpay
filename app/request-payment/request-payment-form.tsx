"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { ProfileSummary } from "@/lib/supabase/otpay-queries";

type RequestPaymentFormProps = {
  profiles: ProfileSummary[];
  initialProfileId: string | null;
};

type RequestPaymentResponse = {
  ok: boolean;
  message?: string;
  data?: {
    paymentIntent: {
      id: string;
      status: string;
      recipient_phone_number: string;
      amount: number;
      currency: string;
      note: string | null;
    };
    senderProfile: {
      id: string;
      display_name: string;
    };
  };
  error?: string;
};

type FormState = {
  senderProfileId: string;
  recipientPhoneNumber: string;
  amount: string;
  note: string;
};

export function RequestPaymentForm({
  profiles,
  initialProfileId,
}: RequestPaymentFormProps) {
  const defaultProfileId = initialProfileId ?? profiles[0]?.id ?? "";
  const [form, setForm] = useState<FormState>({
    senderProfileId: defaultProfileId,
    recipientPhoneNumber: "",
    amount: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<RequestPaymentResponse["data"] | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === form.senderProfileId) ?? null,
    [form.senderProfileId, profiles],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(null);

    const response = await fetch("/api/payment-intents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        senderProfileId: form.senderProfileId,
        recipientPhoneNumber: form.recipientPhoneNumber,
        amount: form.amount,
        currency: "USDC",
        note: form.note,
      }),
    });

    const payload = (await response.json()) as RequestPaymentResponse;

    if (!response.ok || !payload.ok || !payload.data) {
      setError(payload.error ?? "Could not create this payment request right now.");
      setSubmitting(false);
      return;
    }

    setSuccess(payload.data);
    setSubmitting(false);
    setForm((current) => ({
      ...current,
      recipientPhoneNumber: "",
      amount: "",
      note: "",
    }));
  }

  return (
    <div className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
      <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Step 2</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
        Request a payment
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
        Create a pending USDC request for any verified OTPay phone number. The
        recipient can review it, approve it, and later settle it on Solana.
      </p>

      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-semibold text-zinc-900">
          Requesting profile
          <select
            className="min-h-13 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
            value={form.senderProfileId}
            onChange={(event) =>
              setForm((current) => ({ ...current, senderProfileId: event.target.value }))
            }
            required
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.display_name} · {profile.phone_number ?? "No phone"}
              </option>
            ))}
          </select>
        </label>

        {selectedProfile ? (
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-700">
            <p className="font-semibold text-zinc-950">Sender context</p>
            <p className="mt-2">
              Wallet <span className="font-mono text-xs">{selectedProfile.wallet_address}</span>
            </p>
            <p className="mt-1">
              Phone <span className="font-mono">{selectedProfile.phone_number ?? "Unlinked"}</span>
            </p>
          </div>
        ) : null}

        <label className="grid gap-2 text-sm font-semibold text-zinc-900">
          Recipient phone number
          <input
            className="min-h-13 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
            value={form.recipientPhoneNumber}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                recipientPhoneNumber: event.target.value,
              }))
            }
            placeholder="+977 98XXXXXXXX"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-zinc-900">
          Amount (USDC)
          <input
            className="min-h-13 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
            value={form.amount}
            onChange={(event) =>
              setForm((current) => ({ ...current, amount: event.target.value }))
            }
            placeholder="25"
            inputMode="decimal"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-zinc-900">
          Note
          <textarea
            className="min-h-28 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
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
          disabled={submitting || !profiles.length}
          className="mt-2 min-h-13 rounded-full bg-lime-500 px-5 py-3 text-base font-bold text-zinc-950 transition hover:bg-lime-400 disabled:cursor-wait disabled:opacity-75"
        >
          {submitting ? "Creating request..." : "Create payment request"}
        </button>
      </form>

      {success ? (
        <div className="mt-8 rounded-3xl border border-lime-200 bg-lime-50 px-5 py-5 text-sm text-lime-950">
          <p className="font-semibold">Request created.</p>
          <p className="mt-2">
            Intent <span className="font-mono">{success.paymentIntent.id}</span> is now{" "}
            <span className="font-semibold">{success.paymentIntent.status}</span>.
          </p>
          <p className="mt-1">
            Recipient <span className="font-mono">{success.paymentIntent.recipient_phone_number}</span>
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/approve/${success.paymentIntent.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Review approval page
            </Link>
            <Link
              href={`/dashboard?profileId=${success.senderProfile.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
