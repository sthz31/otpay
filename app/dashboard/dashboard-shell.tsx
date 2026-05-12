"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  getSolscanDevnetAddressUrl,
  getSolscanDevnetTransactionUrl,
} from "@/lib/solana/explorer";
import type {
  PaymentIntentSummary,
  ProfileSummary,
} from "@/lib/supabase/otpay-queries";
import { LogoutButton } from "./logout-button";

type WalletBalances = {
  sol: number | null;
  usdc: number | null;
  usdcAta: string;
};

type DashboardShellProps = {
  profile: ProfileSummary;
  balances: WalletBalances;
  recentIntents: PaymentIntentSummary[];
  outstandingIncoming: PaymentIntentSummary[];
  view?: "wallet" | "requests" | "activity" | "profile";
};

type TopUpResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  data?: {
    solAmount: number;
    usdcAmount: number;
    solError: string | null;
    solSignature: string | null;
    usdcSignature: string | null;
    balances: WalletBalances;
  };
};

type IconName =
  | "activity"
  | "arrow-down-left"
  | "arrow-up-right"
  | "check"
  | "copy"
  | "external"
  | "menu"
  | "plus"
  | "shield"
  | "user"
  | "wallet"
  | "x";

const navigation = [
  { label: "Wallet", href: "/dashboard", icon: "wallet" },
  { label: "Pay requests", href: "/requests", icon: "shield" },
  { label: "Request", href: "/request-payment", icon: "plus" },
  { label: "Activity", href: "/activity", icon: "activity" },
  { label: "Profile", href: "/profile", icon: "user" },
] satisfies { label: string; href: string; icon: IconName }[];

const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#00e95a_0%,#00c84b_100%)] px-5 text-sm font-extrabold text-[var(--foreground)] shadow-[0_10px_24px_rgba(0,214,79,0.18)] transition hover:brightness-105 hover:shadow-[0_12px_28px_rgba(0,214,79,0.24)] active:translate-y-px active:brightness-95 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white/72 px-5 text-sm font-bold text-[var(--foreground)] transition hover:bg-white active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

const topUpAmounts = [10, 25, 50] as const;
const lowSolThreshold = 0.003;
const demoCardDefaults = {
  name: "Fresh Payer",
  number: "4242 4242 4242 4242",
  expiry: "12/30",
  cvc: "123",
};

function formatAmount(amount: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(amount);
}

function formatTokenBalance(value: number | null, symbol: string) {
  if (value === null) return `-- ${symbol}`;
  return `${formatAmount(value, symbol === "SOL" ? 4 : 2)} ${symbol}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function truncateAddress(value: string, chars = 5) {
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function useActiveNavLabel() {
  const pathname = usePathname();

  if (pathname === "/request-payment") return "Request";
  if (pathname === "/requests") return "Pay requests";
  if (pathname === "/activity") return "Activity";
  if (pathname === "/profile") return "Profile";
  return "Wallet";
}

export function DashboardShell({
  profile,
  balances,
  recentIntents,
  outstandingIncoming,
  view = "wallet",
}: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const activeNavLabel = useActiveNavLabel();

  useEffect(() => {
    if (!drawerOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className="h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <MobileTopBar
        menuButtonRef={menuButtonRef}
        profileName={profile.display_name}
        onOpen={() => setDrawerOpen(true)}
      />
      <MobileNavDrawer
        activeNavLabel={activeNavLabel}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        profile={profile}
      />

      <div className="mx-auto grid h-full w-full max-w-[1440px] overflow-hidden lg:grid-cols-[244px_minmax(0,1fr)]">
        <Sidebar activeNavLabel={activeNavLabel} profile={profile} />

        <main className="flex h-full min-w-0 flex-col overflow-hidden lg:p-4">
          <TopBar
            profileName={profile.display_name}
            pendingCount={outstandingIncoming.length}
            view={view}
          />

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-20 sm:px-6 lg:mt-4 lg:px-4 lg:pt-0">
            {view === "wallet" ? (
              <div className="grid gap-6">
                <WalletHero balances={balances} />
                <WalletDetailsCard profile={profile} balances={balances} />
              </div>
            ) : null}

            {view === "requests" ? (
              <PendingPaymentsSection requests={outstandingIncoming} profileId={profile.id} />
            ) : null}

            {view === "activity" ? (
              <RecentActivitySection profileId={profile.id} intents={recentIntents} flushTop />
            ) : null}

            {view === "profile" ? (
              <ProfileSettings profile={profile} />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function WalletHero({
  balances,
}: {
  balances: WalletBalances;
}) {
  const router = useRouter();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<(typeof topUpAmounts)[number]>(25);
  const [cardName, setCardName] = useState(demoCardDefaults.name);
  const [cardNumber, setCardNumber] = useState(demoCardDefaults.number);
  const [cardExpiry, setCardExpiry] = useState(demoCardDefaults.expiry);
  const [cardCvc, setCardCvc] = useState(demoCardDefaults.cvc);
  const [submitting, setSubmitting] = useState(false);
  const [topUpError, setTopUpError] = useState("");
  const [topUpResult, setTopUpResult] = useState<TopUpResponse["data"] | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const topUpTriggerRef = useRef<HTMLButtonElement>(null);
  const hasLowSol = (balances.sol ?? 0) < lowSolThreshold;

  useEffect(() => {
    if (!topUpOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTopUpOpen(false);
        topUpTriggerRef.current?.focus();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [topUpOpen]);

  async function handleTopUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setTopUpError("");
    setTopUpResult(null);

    try {
      const response = await fetch("/api/wallet/top-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usdcAmount: selectedAmount,
        }),
      });
      const payload = (await response.json()) as TopUpResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not load demo funds right now.");
      }

      setTopUpResult(payload.data);
      setCardName(demoCardDefaults.name);
      setCardNumber(demoCardDefaults.number);
      setCardExpiry(demoCardDefaults.expiry);
      setCardCvc(demoCardDefaults.cvc);
      router.refresh();
    } catch (error) {
      setTopUpError(error instanceof Error ? error.message : "Could not load demo funds right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="wallet"
      className="rounded-[32px] border border-white/70 bg-[#0b160c] p-6 text-[#f3fde8] shadow-[0_28px_90px_rgba(8,17,9,0.18)] sm:p-8"
    >
      <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[#dfffe8]">
              Devnet wallet
            </span>
            <span className="rounded-full border border-[#00e95a]/30 bg-[#00e95a]/12 px-3 py-1 text-xs font-bold text-[#dfffe8]">
              Phone verified
            </span>
          </div>
          <p className="mt-6 text-sm font-semibold text-[#a9c8ae]">Available balance</p>
          <h1 className="mt-2 font-mono text-5xl font-semibold tracking-[-0.06em] text-[#f3fde8] sm:text-6xl">
            {formatTokenBalance(balances.usdc, "USDC")}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#a9c8ae]">
            Load test funds, request USDC by phone, and open devnet proof from one place.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[340px]">
          <BalancePill label="USDC" value={formatTokenBalance(balances.usdc, "USDC")} />
          <BalancePill label="Fees" value={formatTokenBalance(balances.sol, "SOL")} />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          ref={topUpTriggerRef}
          type="button"
          onClick={() => {
            setTopUpError("");
            setTopUpResult(null);
            setTopUpOpen(true);
          }}
          className={`${primaryButtonClassName} sm:w-fit`}
        >
          Load USDC from card
        </button>
        <Link href="/request-payment" className={`${secondaryButtonClassName} border-white/10 bg-white/10 text-[#f3fde8] hover:bg-white/14 sm:w-fit`}>
          Request payment
        </Link>
      </div>
      {hasLowSol ? (
        <p className="mt-4 rounded-2xl border border-[#f6e58d]/20 bg-[#f6e58d]/10 px-4 py-3 text-sm font-semibold text-[#f8f4c0]">
          Add SOL for fees before paying requests.
        </p>
      ) : null}

      {topUpOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[rgba(5,17,6,0.42)] px-4 py-6 text-[var(--foreground)] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="top-up-title"
          onClick={() => {
            setTopUpOpen(false);
            topUpTriggerRef.current?.focus();
          }}
        >
          <div
            className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/70 bg-[rgba(245,255,244,0.98)] p-5 shadow-[0_28px_90px_rgba(8,17,9,0.24)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Demo card top-up
                </p>
                <h2
                  id="top-up-title"
                  className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]"
                >
                  Load USDC from card
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">
                  Simulate a card payment. OTPay only sends the preset amount to the server;
                  these card details are never stored.
                </p>
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                  Demo limit: 100 USDC per wallet per UTC day.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close load funds dialog"
                onClick={() => {
                  setTopUpOpen(false);
                  topUpTriggerRef.current?.focus();
                }}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--foreground)] transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              >
                <Icon name="x" />
              </button>
            </div>

            <form className="mt-6 grid gap-5" onSubmit={handleTopUp}>
              <fieldset className="grid gap-3">
                <legend className="text-sm font-bold text-[var(--foreground)]">Amount</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {topUpAmounts.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setSelectedAmount(amount)}
                      className={`min-h-20 rounded-[24px] border px-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
                        selectedAmount === amount
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_12px_30px_rgba(0,214,79,0.14)]"
                          : "border-black/10 bg-white hover:bg-[var(--accent-soft)]"
                      }`}
                    >
                      <span className="block font-mono text-2xl font-semibold tracking-[-0.04em]">
                        {amount} USDC
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">
                        + 0.05 SOL fees
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 rounded-[26px] border border-black/10 bg-white/76 p-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  Name on card
                  <input
                    className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    value={cardName}
                    onChange={(event) => setCardName(event.target.value)}
                    placeholder="Fresh Payer"
                    autoComplete="cc-name"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Card number
                  <input
                    className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 font-mono text-sm outline-none transition focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    value={cardNumber}
                    onChange={(event) => setCardNumber(event.target.value)}
                    placeholder="4242 4242 4242 4242"
                    autoComplete="cc-number"
                    inputMode="numeric"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Expiry
                  <input
                    className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 font-mono text-sm outline-none transition focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    value={cardExpiry}
                    onChange={(event) => setCardExpiry(event.target.value)}
                    placeholder="12/30"
                    autoComplete="cc-exp"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  CVC
                  <input
                    className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 font-mono text-sm outline-none transition focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    value={cardCvc}
                    onChange={(event) => setCardCvc(event.target.value)}
                    placeholder="123"
                    autoComplete="cc-csc"
                    inputMode="numeric"
                    required
                  />
                </label>
              </div>

              {topUpError ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {topUpError}
                </p>
              ) : null}

              {topUpResult ? (
                <div className="rounded-[24px] border border-[rgba(0,214,79,0.28)] bg-[var(--accent-soft)] p-4 text-sm">
                  <p className="font-bold text-[var(--foreground)]">Funds loaded.</p>
                  <p className="mt-1 text-[var(--muted)]">
                    Added {topUpResult.usdcAmount} USDC
                    {topUpResult.solSignature ? ` and ${topUpResult.solAmount} SOL` : ""} to
                    this devnet wallet.
                  </p>
                  {topUpResult.solError ? (
                    <p className="mt-3 rounded-2xl border border-[#f6e58d]/40 bg-[#fff8c8]/70 px-4 py-3 text-sm font-semibold text-[#5c4d00]">
                      USDC loaded, but treasury SOL funding failed. Add SOL to the treasury wallet
                      and try Load USDC from card again before paying requests.
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-2">
                    {topUpResult.usdcSignature ? (
                      <a
                        href={getSolscanDevnetTransactionUrl(topUpResult.usdcSignature)}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-mono text-xs font-semibold underline decoration-lime-700/40 underline-offset-4"
                      >
                        USDC transfer: {topUpResult.usdcSignature}
                      </a>
                    ) : null}
                    {topUpResult.solSignature ? (
                      <a
                        href={getSolscanDevnetTransactionUrl(topUpResult.solSignature)}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-mono text-xs font-semibold underline decoration-lime-700/40 underline-offset-4"
                      >
                        SOL gas transfer: {topUpResult.solSignature}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting}
                  className={primaryButtonClassName}
                >
                  {submitting ? "Loading funds..." : `Load ${selectedAmount} USDC`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTopUpOpen(false);
                    topUpTriggerRef.current?.focus();
                  }}
                  className={secondaryButtonClassName}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BalancePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#a9c8ae]">
        {label}
      </p>
      <p className="mt-2 truncate font-mono text-sm font-bold text-[#f3fde8]">{value}</p>
    </div>
  );
}

function WalletDetailsCard({
  profile,
  balances,
}: {
  profile: ProfileSummary;
  balances: WalletBalances;
}) {
  return (
    <section className="rounded-[32px] border border-white/70 bg-white/84 p-5 shadow-[0_24px_80px_rgba(8,17,9,0.08)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Wallet details
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Test custody
          </h2>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--foreground)]">
          Devnet
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        {profile.otpay_tag ? <AddressRow label="OTPay tag" value={`@${profile.otpay_tag}`} /> : null}
        <AddressRow label="Wallet address" value={profile.wallet_address} />
        <AddressRow label="USDC token account" value={balances.usdcAta} />
      </div>

      <a
        href={getSolscanDevnetAddressUrl(profile.wallet_address)}
        target="_blank"
        rel="noreferrer"
        className={`${secondaryButtonClassName} mt-5 w-full gap-2`}
      >
        View wallet on Solscan
        <Icon name="external" />
      </a>
    </section>
  );
}

function AddressRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="rounded-[24px] border border-black/10 bg-[rgba(245,255,244,0.72)] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-[var(--foreground)]">
          {truncateAddress(value)}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--foreground)] transition hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          <Icon name={copied ? "check" : "copy"} />
        </button>
      </div>
    </div>
  );
}

function ProfileSettings({ profile }: { profile: ProfileSummary }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [otpayTag, setOtpayTag] = useState(profile.otpay_tag ? `@${profile.otpay_tag}` : "");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPin: currentPin || undefined,
          displayName,
          newPin: newPin || undefined,
          otpayTag,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Could not update profile.");
      }

      setCurrentPin("");
      setNewPin("");
      setSuccess(payload.message ?? "Profile updated.");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form
        onSubmit={handleSubmit}
        className="rounded-[32px] border border-white/70 bg-white/84 p-5 shadow-[0_24px_80px_rgba(8,17,9,0.08)] sm:p-6"
      >
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Profile
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
            Edit account
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Update your visible name, OTPay tag, or change the 4-digit PIN used to open this test
            wallet.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              placeholder="Fresh Requester"
              autoComplete="name"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">
            OTPay tag
            <input
              value={otpayTag}
              onChange={(event) => setOtpayTag(event.target.value)}
              className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 font-mono text-sm outline-none transition focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              placeholder="@freshpayer"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <span className="text-xs font-medium leading-5 text-[var(--muted)]">
              Use 3-30 letters, numbers, or underscores. People can request you with this tag.
            </span>
          </label>

          <div className="grid gap-4 rounded-[26px] border border-black/10 bg-[rgba(245,255,244,0.7)] p-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">
              Current PIN
              <input
                value={currentPin}
                onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 font-mono text-sm outline-none transition focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                type="password"
                autoComplete="current-password"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">
              New PIN
              <input
                value={newPin}
                onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 font-mono text-sm outline-none transition focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                inputMode="numeric"
                maxLength={4}
                placeholder="4321"
                type="password"
                autoComplete="new-password"
              />
            </label>
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-5 rounded-2xl border border-[rgba(0,214,79,0.28)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
            {success}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={saving} aria-busy={saving} className={primaryButtonClassName}>
            {saving ? "Saving..." : "Save profile"}
          </button>
          <Link href="/dashboard" className={secondaryButtonClassName}>
            Back to wallet
          </Link>
        </div>
      </form>

      <aside className="grid gap-4">
        <div className="rounded-[32px] border border-white/70 bg-white/84 p-5 shadow-[0_24px_80px_rgba(8,17,9,0.08)] sm:p-6">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Account
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-extrabold text-[var(--foreground)]"
              aria-hidden="true"
            >
              {initials(profile.display_name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--foreground)]">
                {profile.display_name}
              </p>
              <p className="truncate font-mono text-xs text-[var(--muted)]">
                {profile.otpay_tag ? `@${profile.otpay_tag}` : "No tag yet"}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {profile.phone_number ? <AddressRow label="Phone" value={profile.phone_number} /> : null}
            <AddressRow label="Wallet address" value={profile.wallet_address} />
          </div>
        </div>
      </aside>
    </section>
  );
}

function PendingPaymentsSection({
  requests,
  profileId,
}: {
  requests: PaymentIntentSummary[];
  profileId: string;
}) {
  return (
    <section
      id="requests"
      className="rounded-[32px] border border-white/70 bg-white/84 p-5 shadow-[0_24px_80px_rgba(8,17,9,0.08)] sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Pay requests
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Waiting for you
          </h2>
        </div>
        <span className="inline-flex min-h-9 w-fit items-center rounded-full bg-[var(--accent-soft)] px-3 text-sm font-bold text-[var(--foreground)]">
          {requests.length} pending
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        {requests.length ? (
          requests.map((intent) => (
            <RequestCard key={intent.id} intent={intent} profileId={profileId} />
          ))
        ) : (
          <EmptyState
            title="No payments waiting"
            body="Incoming requests you need to approve will appear here."
            actionLabel="Request from someone"
            actionHref="/request-payment"
          />
        )}
      </div>
    </section>
  );
}

function RequestCard({
  intent,
  profileId,
}: {
  intent: PaymentIntentSummary;
  profileId: string;
}) {
  const counterparty =
    intent.sender_profile_id === profileId
      ? intent.recipient_display_name ?? "Unknown requester"
      : intent.sender_display_name ?? intent.payer_phone_number ?? "Unknown payer";

  return (
    <article className="rounded-[26px] border border-black/10 bg-[rgba(245,255,244,0.72)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            {formatAmount(intent.amount)} {intent.currency}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
            Requested by {counterparty}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {formatDate(intent.created_at)}
            {intent.note ? ` · ${intent.note}` : ""}
          </p>
        </div>
        <Link
          href={`/approve/${intent.id}`}
          className={`${primaryButtonClassName} shrink-0`}
        >
          Pay request
        </Link>
      </div>
    </article>
  );
}

function RecentActivitySection({
  intents,
  profileId,
  flushTop = false,
}: {
  intents: PaymentIntentSummary[];
  profileId: string;
  flushTop?: boolean;
}) {
  return (
    <section
      id="activity"
      className={`${flushTop ? "" : "mt-6"} rounded-[32px] border border-white/70 bg-white/84 p-5 shadow-[0_24px_80px_rgba(8,17,9,0.08)] sm:p-6`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Activity
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Wallet history
          </h2>
        </div>
        <p className="text-sm font-medium text-[var(--muted)]">Latest requests and settlements</p>
      </div>

      <div className="mt-5 grid gap-3">
        {intents.length ? (
          intents.map((intent) => (
            <ActivityItem key={intent.id} intent={intent} profileId={profileId} />
          ))
        ) : (
          <EmptyState
            title="No wallet activity"
            body="Create a payment request to start tracking approvals and devnet settlement."
            actionLabel="Request payment"
            actionHref="/request-payment"
          />
        )}
      </div>
    </section>
  );
}

function ActivityItem({
  intent,
  profileId,
}: {
  intent: PaymentIntentSummary;
  profileId: string;
}) {
  const isPayer = intent.sender_profile_id === profileId;
  const counterparty = isPayer
    ? intent.recipient_display_name ?? "Unknown requester"
    : intent.sender_display_name ?? intent.payer_phone_number ?? "Unknown payer";
  const href = intent.status === "pending" && isPayer ? `/approve/${intent.id}` : `/status/${intent.id}`;

  return (
    <div className="grid gap-3 rounded-[24px] border border-black/10 bg-[rgba(245,255,244,0.64)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <Link
        href={href}
        className="flex min-w-0 items-start gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      >
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--foreground)]">
          <Icon name={isPayer ? "arrow-up-right" : "arrow-down-left"} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold text-[var(--foreground)]">
              {isPayer ? "Paid request" : "Requested payment"}
            </p>
            <StatusChip status={intent.status} />
          </div>
          <p className="mt-1 truncate text-sm text-[var(--muted)]">
            {counterparty} · {formatDate(intent.created_at)}
          </p>
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <p className="font-mono text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          {isPayer ? "-" : "+"}
          {formatAmount(intent.amount)} {intent.currency}
        </p>
        {intent.transaction_signature ? (
          <a
            href={getSolscanDevnetTransactionUrl(intent.transaction_signature)}
            target="_blank"
            rel="noreferrer"
            aria-label="Open transaction on Solscan"
            className="inline-flex size-10 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--foreground)] transition hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            <Icon name="external" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: PaymentIntentSummary["status"] }) {
  const labels: Record<PaymentIntentSummary["status"], string> = {
    approved: "Approved",
    failed: "Failed",
    pending: "Pending",
    rejected: "Rejected",
    settled: "Settled",
    settling: "Settling",
  };

  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-white px-2.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-strong)]">
      {labels[status]}
    </span>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  actionHref,
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="rounded-[26px] border border-dashed border-black/10 bg-[rgba(245,255,244,0.68)] p-6 text-[var(--foreground)]">
      <p className="text-base font-bold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
      <Link href={actionHref} className={`${primaryButtonClassName} mt-5`}>
        {actionLabel}
      </Link>
    </div>
  );
}

function Sidebar({
  activeNavLabel,
  profile,
}: {
  activeNavLabel: string;
  profile: ProfileSummary;
}) {
  return (
    <aside className="hidden h-full min-h-0 border-r border-black/10 bg-white/42 p-3 backdrop-blur-xl lg:flex lg:flex-col">
      <div className="flex h-full flex-col rounded-[30px] border border-white/70 bg-white/74 p-4 shadow-[0_22px_64px_rgba(8,17,9,0.08)]">
        <BrandMark />
        <nav className="mt-7 grid gap-1.5" aria-label="Primary navigation">
          {navigation.map((item) => (
            <NavItem key={item.label} item={item} active={item.label === activeNavLabel} />
          ))}
        </nav>
        <div className="mt-7 rounded-[26px] border border-black/10 bg-[rgba(245,255,244,0.66)] p-4">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Wallet mode
          </p>
          <p className="mt-2 text-sm font-bold text-[var(--foreground)]">Devnet payments</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            OTP approvals settle from this test wallet.
          </p>
        </div>
        <div className="mt-auto grid gap-2.5 pt-5">
          <ProfileBlock profile={profile} />
          <LogoutButton className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-black/10 bg-white/74 px-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2" />
        </div>
      </div>
    </aside>
  );
}

function MobileTopBar({
  profileName,
  onOpen,
  menuButtonRef,
}: {
  profileName: string;
  onOpen: () => void;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="fixed inset-x-3 top-3 z-40 flex min-h-14 items-center justify-between rounded-full border border-white/70 bg-white/84 px-3 shadow-[0_16px_34px_rgba(10,24,10,0.1)] backdrop-blur lg:hidden">
      <BrandMark compact />
      <div className="flex items-center gap-2">
        <span className="hidden max-w-28 truncate text-sm font-semibold text-[var(--muted)] sm:inline">
          {profileName}
        </span>
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Open navigation menu"
          aria-expanded="false"
          onClick={onOpen}
          className="inline-flex size-11 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--foreground)] transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          <Icon name="menu" />
        </button>
      </div>
    </header>
  );
}

function MobileNavDrawer({
  activeNavLabel,
  isOpen,
  onClose,
  profile,
}: {
  activeNavLabel: string;
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileSummary;
}) {
  return (
    <div className={isOpen ? "lg:hidden" : "pointer-events-none lg:hidden"} aria-hidden={!isOpen}>
      <button
        type="button"
        aria-label="Close navigation menu"
        className={`fixed inset-0 z-50 bg-[rgba(5,17,6,0.34)] transition-opacity duration-200 motion-reduce:transition-none ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className={`fixed inset-y-0 left-0 z-50 w-[min(88vw,360px)] transform bg-[var(--background)] p-3 shadow-[0_28px_90px_rgba(8,17,9,0.25)] transition-transform duration-200 motion-reduce:transition-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col rounded-[30px] border border-white/70 bg-white/86 p-4">
          <div className="flex items-center justify-between gap-3">
            <BrandMark />
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={onClose}
              className="inline-flex size-11 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--foreground)] transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              <Icon name="x" />
            </button>
          </div>
          <nav className="mt-8 grid gap-2" aria-label="Mobile primary navigation">
            {navigation.map((item) => (
              <NavItem
                key={item.label}
                item={item}
                active={item.label === activeNavLabel}
                onSelect={onClose}
              />
            ))}
          </nav>
          <div className="mt-auto grid gap-3">
            <ProfileBlock profile={profile} />
            <LogoutButton className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2" />
          </div>
        </div>
      </aside>
    </div>
  );
}

function TopBar({
  profileName,
  pendingCount,
  view,
}: {
  profileName: string;
  pendingCount: number;
  view: NonNullable<DashboardShellProps["view"]>;
}) {
  const titleByView = {
    activity: "Activity history",
    profile: "Profile settings",
    requests: "Pay requests",
    wallet: `Wallet for ${profileName}`,
  } satisfies Record<NonNullable<DashboardShellProps["view"]>, string>;
  const helperByView = {
    activity: "Track requests, approvals, and devnet settlement.",
    profile: "Edit your name, OTPay tag, and PIN.",
    requests: pendingCount
      ? `${pendingCount} payment request${pendingCount === 1 ? "" : "s"} waiting`
      : "No payments waiting",
    wallet: "Load demo USDC and manage your devnet wallet.",
  } satisfies Record<NonNullable<DashboardShellProps["view"]>, string>;

  return (
    <header className="hidden min-h-16 shrink-0 items-center justify-between gap-4 rounded-full border border-white/70 bg-white/76 px-5 shadow-[0_16px_34px_rgba(10,24,10,0.08)] backdrop-blur lg:flex">
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{titleByView[view]}</p>
        <p className="text-xs font-medium text-[var(--muted)]">{helperByView[view]}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex min-h-10 items-center rounded-full border border-black/10 bg-[var(--accent-soft)] px-4 text-sm font-bold text-[var(--foreground)]">
          Devnet
        </span>
      </div>
    </header>
  );
}

function NavItem({
  item,
  active,
  onSelect,
}: {
  item: (typeof navigation)[number];
  active?: boolean;
  onSelect?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex min-h-11 items-center gap-3 rounded-full px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
        active
          ? "bg-[linear-gradient(180deg,#00e95a_0%,#00c84b_100%)] text-[var(--foreground)] shadow-[0_10px_24px_rgba(0,214,79,0.22)]"
          : "text-[var(--muted)] hover:bg-white/80 hover:text-[var(--foreground)]"
      }`}
    >
      {active ? (
        <span
          className="absolute left-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-[var(--foreground)]"
          aria-hidden="true"
        />
      ) : null}
      <Icon name={item.icon} />
      <span className={active ? "pl-2" : ""}>{item.label}</span>
    </Link>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 font-bold tracking-[-0.03em] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      aria-label="OTPay home"
    >
      <Image src="/otpay.png" alt="" width={36} height={36} className="rounded-full" priority />
      {!compact ? <span>OTPay</span> : null}
    </Link>
  );
}

function ProfileBlock({ profile }: { profile: ProfileSummary }) {
  return (
    <div className="rounded-[26px] border border-black/10 bg-[rgba(245,255,244,0.84)] p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-extrabold text-[var(--foreground)]"
          aria-hidden="true"
        >
          {initials(profile.display_name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--foreground)]">{profile.display_name}</p>
          <p className="truncate font-mono text-xs text-[var(--muted)]">
            {profile.otpay_tag ? `@${profile.otpay_tag}` : profile.phone_number ?? "No phone linked"}
          </p>
        </div>
      </div>
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
  };

  return (
    <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24" {...common}>
      {name === "activity" ? <path d="M3 12h4l3 7 4-14 3 7h4" /> : null}
      {name === "arrow-down-left" ? <path d="M17 7 7 17M7 7v10h10" /> : null}
      {name === "arrow-up-right" ? <path d="M7 17 17 7M7 7h10v10" /> : null}
      {name === "check" ? <path d="m5 12 5 5L20 7" /> : null}
      {name === "copy" ? (
        <>
          <rect width="13" height="13" x="9" y="9" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      ) : null}
      {name === "external" ? (
        <>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <path d="M15 3h6v6" />
          <path d="m10 14 11-11" />
        </>
      ) : null}
      {name === "menu" ? (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      ) : null}
      {name === "plus" ? (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      ) : null}
      {name === "shield" ? (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-5" />
        </>
      ) : null}
      {name === "user" ? (
        <>
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </>
      ) : null}
      {name === "wallet" ? (
        <>
          <path d="M19 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6" />
          <path d="M18 12h.01" />
        </>
      ) : null}
      {name === "x" ? (
        <>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </>
      ) : null}
    </svg>
  );
}
