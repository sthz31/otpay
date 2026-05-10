"use client";

import { FormEvent, useEffect, useEffectEvent, useState } from "react";
import {
  useCreateWallet,
  useLoginWithSms,
  usePrivy,
} from "@privy-io/react-auth";
import { ACTIVE_PROFILE_STORAGE_KEY } from "@/lib/auth/session";

type PrivyPhoneAuthCardProps = {
  mode: "register" | "login";
};

type SyncResponse = {
  ok: boolean;
  message?: string;
  data?: {
    profile: {
      id: string;
      display_name: string;
      wallet_address: string;
      privy_user_id?: string | null;
    };
    phoneLink: {
      phone_number: string;
      is_verified: boolean;
    };
  };
  error?: string;
};

export function PrivyPhoneAuthCard({ mode }: PrivyPhoneAuthCardProps) {
  const isRegister = mode === "register";
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithSms();
  const { createWallet } = useCreateWallet();

  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "syncing">("phone");
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [didSync, setDidSync] = useState(false);
  const [error, setError] = useState("");

  async function buildAuthHeaders() {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      throw new Error("Privy access token unavailable. Try logging in again.");
    }

    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async function syncProfile(afterWalletRetry = false) {
    setSyncing(true);
    setStep("syncing");
    setError("");

    try {
      const response = await fetch("/api/auth/privy/sync", {
        method: "POST",
        headers: await buildAuthHeaders(),
        body: JSON.stringify({
          displayName: isRegister ? displayName : undefined,
        }),
      });

      const payload = (await response.json()) as SyncResponse;

      if (
        !response.ok &&
        response.status === 409 &&
        !afterWalletRetry
      ) {
        await createWallet();
        await syncProfile(true);
        return;
      }

      if (!response.ok || !payload.ok || !payload.data?.profile) {
        setError(payload.error ?? "Could not finish Privy sign-in right now.");
        setSyncing(false);
        setSubmitting(false);
        setStep("otp");
        return;
      }

      window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, payload.data.profile.id);
      setDidSync(true);
      window.location.href = "/dashboard";
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Could not finish Privy sign-in right now.",
      );
      setSyncing(false);
      setSubmitting(false);
      setStep("otp");
    }
  }

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await sendCode({
        phoneNumber,
      });
      setStep("otp");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send the verification code.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await loginWithCode({
        code: otpCode,
      });
      setStep("syncing");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "That code could not be verified.",
      );
      setSubmitting(false);
    }
  }

  const syncProfileOnAuth = useEffectEvent(async () => {
    await syncProfile();
  });

  useEffect(() => {
    if (!ready || !authenticated || syncing || didSync) {
      return;
    }

    void syncProfileOnAuth();
  }, [authenticated, didSync, ready, syncing]);

  return (
    <div className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
      <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">
        {step === "phone"
          ? "Privy onboarding"
          : step === "otp"
            ? "Verify phone"
            : "Syncing profile"}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
        {isRegister ? "Register with Privy" : "Log in with Privy"}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
        {isRegister
          ? "Verify your phone number with SMS, let Privy create your Solana wallet, and OTPay will link or create the right profile automatically."
          : "Verify your phone number with SMS and OTPay will restore the linked dashboard profile automatically."}
      </p>

      {step === "phone" ? (
        <form className="mt-8 grid gap-4" onSubmit={handleSendCode}>
          {isRegister ? (
            <label className="grid gap-2 text-sm font-semibold text-zinc-900">
              Display name
              <input
                className="min-h-13 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Sthz"
                required
              />
            </label>
          ) : null}

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
            {submitting ? "Sending code..." : "Continue with SMS"}
          </button>
        </form>
      ) : null}

      {step === "otp" ? (
        <form className="mt-8 grid gap-4" onSubmit={handleVerifyCode}>
          <div className="rounded-3xl border border-lime-200 bg-lime-50 px-5 py-4 text-sm text-lime-950">
            <p className="font-semibold">Code sent.</p>
            <p className="mt-2">
              Enter the SMS verification code sent to{" "}
              <span className="font-mono">{phoneNumber}</span>.
            </p>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-zinc-900">
            OTP
            <input
              className="min-h-13 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-base font-normal text-zinc-900 outline-none transition focus:border-lime-500"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
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
            className="primary-dark-button mt-2 inline-flex min-h-13 items-center justify-center rounded-full px-5 py-3 text-base font-bold transition disabled:cursor-wait disabled:opacity-75"
          >
            {submitting ? "Verifying..." : "Verify and continue"}
          </button>
        </form>
      ) : null}

      {step === "syncing" ? (
        <div className="mt-8 rounded-3xl border border-lime-200 bg-lime-50 px-5 py-5 text-sm text-lime-950">
          <p className="font-semibold">Preparing your OTPay profile</p>
          <p className="mt-2">
            Privy login succeeded. OTPay is linking your verified phone number and
            embedded Solana wallet to the right dashboard account now.
          </p>
        </div>
      ) : null}
    </div>
  );
}
