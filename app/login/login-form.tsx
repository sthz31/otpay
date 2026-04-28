"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ACTIVE_PROFILE_STORAGE_KEY } from "@/lib/auth/session";

type LoginResponse = {
  ok: boolean;
  message?: string;
  data?: {
    profile: {
      id: string;
      display_name: string;
      wallet_address: string;
    };
    phoneLink: {
      phone_number: string;
    };
  };
  error?: string;
};

export function LoginForm() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber,
        pin,
      }),
    });

    const payload = (await response.json()) as LoginResponse;

    if (!response.ok || !payload.ok || !payload.data?.profile) {
      setError(payload.error ?? "Could not log in right now.");
      setSubmitting(false);
      return;
    }

    window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, payload.data.profile.id);
    window.location.href = "/dashboard";
  }

  return (
    <div className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
      <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Welcome back</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
        Log in to dashboard
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
        Sign in with the phone number you registered and the 4-digit PIN you set
        during onboarding.
      </p>

      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-semibold text-zinc-900">
          Phone number
          <input
            className="min-h-13 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+977 98XXXXXXXX"
            autoComplete="tel"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-zinc-900">
          PIN
          <input
            className="min-h-13 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="4 digits"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={4}
            required
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
          className="primary-dark-button mt-2 inline-flex min-h-13 items-center justify-center rounded-full px-5 py-3 text-base font-bold transition disabled:cursor-wait disabled:opacity-75"
        >
          {submitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/link-phone"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
        >
          Register new account
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
        >
          Back to landing
        </Link>
      </div>
    </div>
  );
}
