"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ACTIVE_PROFILE_COOKIE, ACTIVE_PROFILE_STORAGE_KEY } from "@/lib/auth/session";

type FormState = {
  displayName: string;
  phoneNumber: string;
};

type ProfilePayload = {
  id: string;
  display_name: string;
  wallet_address: string;
  pin_set_at?: string | null;
};

type PhoneLinkPayload = {
  id: string;
  phone_number: string;
  is_verified: boolean;
};

type LinkPhoneResponse = {
  ok: boolean;
  message?: string;
  data?: {
    profile: ProfilePayload;
    phoneLink?: PhoneLinkPayload;
  };
  error?: string;
};

type RegistrationStep = "register" | "otp" | "pin" | "done";

const initialState: FormState = {
  displayName: "",
  phoneNumber: "",
};

export function LinkPhoneForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pendingProfile, setPendingProfile] = useState<ProfilePayload | null>(null);
  const [pendingPhoneLink, setPendingPhoneLink] = useState<PhoneLinkPayload | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<RegistrationStep>("register");
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/phone-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as LinkPhoneResponse;

    if (!response.ok || !payload.ok || !payload.data?.profile || !payload.data.phoneLink) {
      setError(payload.error ?? "Could not register this phone number right now.");
      setSubmitting(false);
      return;
    }

    setPendingProfile(payload.data.profile);
    setPendingPhoneLink(payload.data.phoneLink);
    setOtp("");
    setStep("otp");
    setSubmitting(false);
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/phone-link/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber: pendingPhoneLink?.phone_number ?? form.phoneNumber,
        otp,
      }),
    });

    const payload = (await response.json()) as LinkPhoneResponse;

    if (!response.ok || !payload.ok || !payload.data?.profile) {
      setError(payload.error ?? "Could not verify this phone number right now.");
      setSubmitting(false);
      return;
    }

    setPendingProfile(payload.data.profile);
    setPendingPhoneLink(payload.data.phoneLink ?? pendingPhoneLink);
    setPin("");
    setConfirmPin("");
    setStep("pin");
    setSubmitting(false);
  }

  async function handleSetPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (pin !== confirmPin) {
      setError("PIN confirmation does not match.");
      return;
    }

    if (!pendingProfile) {
      setError("Missing verified profile. Start registration again.");
      return;
    }

    setSubmitting(true);

    const response = await fetch("/api/phone-link/set-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profileId: pendingProfile.id,
        pin,
      }),
    });

    const payload = (await response.json()) as LinkPhoneResponse;

    if (!response.ok || !payload.ok || !payload.data?.profile) {
      setError(payload.error ?? "Could not save your PIN right now.");
      setSubmitting(false);
      return;
    }

    setPendingProfile(payload.data.profile);
    window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, payload.data.profile.id);
    document.cookie = `${ACTIVE_PROFILE_COOKIE}=${payload.data.profile.id}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    setForm(initialState);
    setOtp("");
    setPin("");
    setConfirmPin("");
    setStep("done");
    setSubmitting(false);
  }

  const currentPhoneNumber = pendingPhoneLink?.phone_number ?? form.phoneNumber;

  return (
    <div className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
      <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">
        {step === "register"
          ? "Step 1"
          : step === "otp"
            ? "Step 2"
            : step === "pin"
              ? "Step 3"
              : "Ready"}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
        Register a phone number
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
        OTPay will create your demo wallet automatically, verify your phone number,
        then ask you to set a PIN for dashboard access.
      </p>

      {step === "register" ? (
        <form className="mt-8 grid gap-4" onSubmit={handleRegister}>
          <label className="grid gap-2 text-sm font-semibold text-zinc-900">
            Display name
            <input
              className="min-h-13 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({ ...current, displayName: event.target.value }))
              }
              placeholder="Sthz"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-zinc-900">
            Phone number
            <input
              className="min-h-13 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
              value={form.phoneNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, phoneNumber: event.target.value }))
              }
              placeholder="+977 98XXXXXXXX"
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
            className="mt-2 min-h-13 rounded-full bg-lime-500 px-5 py-3 text-base font-bold text-zinc-950 transition hover:bg-lime-400 disabled:cursor-wait disabled:opacity-75"
          >
            {submitting ? "Creating..." : "Continue"}
          </button>
        </form>
      ) : null}

      {step === "otp" ? (
        <form className="mt-8 grid gap-4" onSubmit={handleVerifyOtp}>
          <div className="rounded-3xl border border-lime-200 bg-lime-50 px-5 py-4 text-sm text-lime-950">
            <p className="font-semibold">Registration created.</p>
            <p className="mt-2">
              Enter the one-time code sent to{" "}
              <span className="font-mono">{currentPhoneNumber}</span>.
            </p>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-zinc-900">
            OTP
            <input
              className="min-h-13 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="Enter code"
              inputMode="numeric"
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
            className="mt-2 min-h-13 rounded-full bg-lime-500 px-5 py-3 text-base font-bold text-zinc-950 transition hover:bg-lime-400 disabled:cursor-wait disabled:opacity-75"
          >
            {submitting ? "Verifying..." : "Verify OTP"}
          </button>
        </form>
      ) : null}

      {step === "pin" ? (
        <form className="mt-8 grid gap-4" onSubmit={handleSetPin}>
          <div className="rounded-3xl border border-lime-200 bg-lime-50 px-5 py-4 text-sm text-lime-950">
            <p className="font-semibold">Phone number verified.</p>
            <p className="mt-2">
              Set a 4-digit PIN so you can sign in to your OTPay dashboard later.
            </p>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-zinc-900">
            Create PIN
            <input
              className="min-h-13 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="4 digits"
              inputMode="numeric"
              maxLength={4}
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-zinc-900">
            Confirm PIN
            <input
              className="min-h-13 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value)}
              placeholder="Repeat PIN"
              inputMode="numeric"
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
            className="mt-2 min-h-13 rounded-full bg-lime-500 px-5 py-3 text-base font-bold text-zinc-950 transition hover:bg-lime-400 disabled:cursor-wait disabled:opacity-75"
          >
            {submitting ? "Saving PIN..." : "Save PIN"}
          </button>
        </form>
      ) : null}

      {step === "done" && pendingProfile ? (
        <div className="mt-8 rounded-3xl border border-lime-200 bg-lime-50 px-5 py-5 text-sm text-lime-950">
          <p className="font-semibold">You are all set.</p>
          <p className="mt-2">
            Your phone number is verified and your dashboard PIN is ready.
          </p>
          <p className="mt-3 font-mono text-xs text-lime-900/80">
            Profile: {pendingProfile.id}
          </p>
          <p className="mt-1 font-mono text-xs text-lime-900/80">
            Phone: {currentPhoneNumber}
          </p>
          <p className="mt-1 font-mono text-xs text-lime-900/80">
            Auto wallet: {pendingProfile.wallet_address}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/dashboard?profileId=${pendingProfile.id}`}
              className="primary-dark-button inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
            >
              Open dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                setForm(initialState);
                setPendingProfile(null);
                setPendingPhoneLink(null);
                setError("");
                setStep("register");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
            >
              Register another number
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
