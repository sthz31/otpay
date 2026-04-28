"use client";

import Link from "next/link";
import { useState } from "react";

type ApproveIntentActionsProps = {
  intentId: string;
};

type DecisionResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};

export function ApproveIntentActions({
  intentId,
}: ApproveIntentActionsProps) {
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"approved" | "rejected" | null>(null);

  async function handleAction(action: "approve" | "reject") {
    setSubmitting(action);
    setError("");
    setResult(null);

    const response = await fetch(`/api/payment-intents/${intentId}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const payload = (await response.json()) as DecisionResponse;

    if (!response.ok || !payload.ok) {
      setError(payload.error ?? `Could not ${action} this request right now.`);
      setSubmitting(null);
      return;
    }

    setResult(action === "approve" ? "approved" : "rejected");
    setSubmitting(null);
  }

  if (result) {
    return (
      <div className="rounded-[28px] border border-lime-200 bg-lime-50 p-6 text-sm text-lime-950">
        <p className="font-semibold">
          Request {result === "approved" ? "approved" : "rejected"} successfully.
        </p>
        <p className="mt-2">
          The dashboard and status page will now reflect the updated state.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/status/${intentId}`}
            className="primary-dark-button inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
          >
            View status
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
      <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Decision</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
        Approve or reject
      </h2>
      <p className="mt-3 text-sm leading-6 text-zinc-600">
        This simulates the recipient action for the hackathon MVP. Once approved, the
        request is ready to move into settlement.
      </p>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={Boolean(submitting)}
          onClick={() => handleAction("approve")}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-lime-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-lime-400 disabled:cursor-wait disabled:opacity-75"
        >
          {submitting === "approve" ? "Approving..." : "Approve request"}
        </button>
        <button
          type="button"
          disabled={Boolean(submitting)}
          onClick={() => handleAction("reject")}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-75"
        >
          {submitting === "reject" ? "Rejecting..." : "Reject request"}
        </button>
      </div>
    </div>
  );
}
