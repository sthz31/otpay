"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type {
  PaymentIntentSummary,
  ProfileSummary,
} from "@/lib/supabase/otpay-queries";
import { LogoutButton } from "./logout-button";

type DashboardShellProps = {
  profile: ProfileSummary;
  recentIntents: PaymentIntentSummary[];
  outstandingIncoming: PaymentIntentSummary[];
};

type IconName =
  | "activity"
  | "arrow-down-left"
  | "arrow-up-right"
  | "bell"
  | "check"
  | "copy"
  | "dashboard"
  | "menu"
  | "settings"
  | "wallet"
  | "x";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Requests", href: "/request-payment", icon: "bell" },
  { label: "Activity", href: "/dashboard#activity", icon: "activity" },
  { label: "Wallet", href: "/dashboard#wallet", icon: "wallet" },
  { label: "Settings", href: "/dashboard#settings", icon: "settings" },
] satisfies { label: string; href: string; icon: IconName }[];

const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#00e95a_0%,#00c84b_100%)] px-5 text-sm font-extrabold text-[var(--foreground)] shadow-[0_10px_24px_rgba(0,214,79,0.18)] transition hover:brightness-105 hover:shadow-[0_12px_28px_rgba(0,214,79,0.24)] active:translate-y-px active:brightness-95 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

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

function truncateAddress(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
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
  const [hash, setHash] = useState("");

  useEffect(() => {
    function syncHash() {
      setHash(window.location.hash);
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);

  if (pathname === "/request-payment") return "Requests";
  if (pathname === "/dashboard" && hash === "#activity") return "Activity";
  if (pathname === "/dashboard" && hash === "#wallet") return "Wallet";
  if (pathname === "/dashboard" && hash === "#settings") return "Settings";
  return "Dashboard";
}

export function DashboardShell({
  profile,
  recentIntents,
  outstandingIncoming,
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

  const settledCount = recentIntents.filter((intent) => intent.status === "settled").length;

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

      <div className="mx-auto grid h-full w-full max-w-[1440px] overflow-hidden lg:grid-cols-[264px_minmax(0,1fr)]">
        <Sidebar activeNavLabel={activeNavLabel} profile={profile} />

        <main className="flex h-full min-w-0 flex-col overflow-hidden lg:p-4">
          <TopBar profileName={profile.display_name} />

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-20 sm:px-6 lg:mt-4 lg:px-4 lg:pt-0">
            <section className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(8,17,9,0.09)] backdrop-blur sm:p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Dashboard
                  </p>
                  <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)] sm:text-4xl lg:text-5xl">
                    OTPay request dashboard
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
                    Review live payment requests, track approvals, and send new requests from one
                    place.
                  </p>
                </div>
                <PrimaryButton href="/request-payment" className="w-full sm:w-fit">
                  Request payment
                </PrimaryButton>
              </div>
            </section>

            <section
              className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1.18fr_0.82fr]"
              aria-label="Account summary"
            >
              <SummaryCard eyebrow="Profile" title={profile.display_name} helper={profile.phone_number ?? "No phone linked"} />
              <WalletCard walletAddress={profile.wallet_address} verified={profile.is_verified} />
              <QueueCard count={outstandingIncoming.length} settledCount={settledCount} />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.06fr)_minmax(360px,0.94fr)]">
              <IncomingRequestsSection profileId={profile.id} requests={outstandingIncoming} />
              <RecentActivitySection profileId={profile.id} intents={recentIntents} />
            </section>

            <section
              id="settings"
              className="mt-6 rounded-[28px] border border-black/10 bg-white/60 p-5 text-sm text-[var(--muted)]"
            >
              <p className="font-semibold text-[var(--foreground)]">Settings</p>
              <p className="mt-1">
                Phone identity, approval preferences, and settlement controls will live here as OTPay
                grows.
              </p>
            </section>
          </div>
        </main>
      </div>
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
            Live rail
          </p>
          <p className="mt-2 text-sm font-bold text-[var(--foreground)]">Phone to wallet</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Requests, approvals, and settlement stay in one flow.
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

function TopBar({ profileName }: { profileName: string }) {
  return (
    <header className="hidden min-h-16 shrink-0 items-center justify-between gap-4 rounded-full border border-white/70 bg-white/76 px-5 shadow-[0_16px_34px_rgba(10,24,10,0.08)] backdrop-blur lg:flex">
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">Welcome back, {profileName}</p>
        <p className="text-xs font-medium text-[var(--muted)]">Phone-first payments on Solana</p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/10 bg-white/64 px-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          Landing
        </Link>
        <Link
          href="/request-payment"
          className={primaryButtonClassName}
        >
          Request payment
        </Link>
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

function PrimaryButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${primaryButtonClassName} ${className}`}>
      {children}
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
            {profile.phone_number ?? "No phone linked"}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  eyebrow,
  title,
  helper,
}: {
  eyebrow: string;
  title: string;
  helper: string;
}) {
  return (
    <article className="rounded-[28px] border border-white/70 bg-white/82 p-5 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 truncate text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mt-2 truncate text-sm font-medium text-[var(--muted)]">{helper}</p>
    </article>
  );
}

function WalletCard({
  walletAddress,
  verified,
}: {
  walletAddress: string;
  verified: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article
      id="wallet"
      className="rounded-[28px] border border-white/70 bg-white/82 p-5 shadow-[0_18px_48px_rgba(8,17,9,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Wallet
          </p>
          <p className="mt-3 truncate font-mono text-sm font-semibold text-[var(--foreground)]">
            {truncateAddress(walletAddress)}
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--muted)]">
            {verified ? "Phone verified" : "Phone verification pending"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy wallet address"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--foreground)] transition hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          <Icon name={copied ? "check" : "copy"} />
        </button>
      </div>
    </article>
  );
}

function QueueCard({ count, settledCount }: { count: number; settledCount: number }) {
  return (
    <article className="rounded-[28px] border border-white/70 bg-white/72 p-5 shadow-[0_18px_48px_rgba(8,17,9,0.05)]">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Queue
      </p>
      <div className="mt-3 flex items-baseline gap-3">
        <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">{count}</h2>
        <span className="text-sm font-semibold text-[var(--muted)]">pending approvals</span>
      </div>
      <p className="mt-2 text-sm font-medium text-[var(--muted)]">
        {count === 0 ? "No approvals waiting" : "Open requests need review"}
      </p>
      <p className="mt-3 font-mono text-xs text-[var(--muted-strong)]">
        {settledCount} settled recently
      </p>
    </article>
  );
}

function IncomingRequestsSection({
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
            Pending approvals
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Requests to pay
          </h2>
        </div>
        <Link
          href="/request-payment"
          className={primaryButtonClassName}
        >
          Request payment
        </Link>
      </div>

      <div className="mt-5 grid gap-3">
        {requests.length ? (
          requests.map((intent) => (
            <RequestCard key={intent.id} intent={intent} profileId={profileId} />
          ))
        ) : (
          <EmptyState
            title="No requests to pay"
            body="You don't have any pending payment requests waiting for your approval."
            actionLabel="Request payment"
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
          <p className="truncate text-base font-bold text-[var(--foreground)]">
            {counterparty} requested {formatAmount(intent.amount)} {intent.currency}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {formatDate(intent.created_at)}
            {intent.note ? ` · ${intent.note}` : ""}
          </p>
        </div>
        <Link
          href={`/approve/${intent.id}`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)] px-4 text-sm font-bold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          Review request
        </Link>
      </div>
    </article>
  );
}

function RecentActivitySection({
  intents,
  profileId,
}: {
  intents: PaymentIntentSummary[];
  profileId: string;
}) {
  return (
    <section
      id="activity"
      className="rounded-[32px] border border-white/70 bg-[#0b160c] p-5 text-[#f3fde8] shadow-[0_28px_90px_rgba(8,17,9,0.18)] sm:p-6"
    >
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#a9c8ae]">
        Recent activity
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Sent and received</h2>

      <div className="mt-5 grid gap-3">
        {intents.length ? (
          intents.map((intent) => (
            <ActivityItem key={intent.id} intent={intent} profileId={profileId} />
          ))
        ) : (
          <div className="rounded-[26px] border border-white/10 bg-white/8 p-5">
            <EmptyState
              inverted
              title="No activity yet"
              body="Create a payment request to start tracking approvals and settlement history."
              actionLabel="Request payment"
              actionHref="/request-payment"
            />
          </div>
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
    <Link
      href={href}
      className="grid gap-3 rounded-[24px] border border-white/10 bg-white/8 p-4 transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b160c] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#dfffe8]">
          <Icon name={isPayer ? "arrow-up-right" : "arrow-down-left"} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold text-[#f3fde8]">
              {isPayer ? "Paying" : "Requested"} request
            </p>
            <StatusChip status={intent.status} />
          </div>
          <p className="mt-1 truncate text-sm text-[#a9c8ae]">
            {counterparty} · {formatDate(intent.created_at)}
          </p>
        </div>
      </div>
      <p className="font-mono text-lg font-semibold tracking-[-0.03em] text-[#f3fde8] sm:text-right">
        {isPayer ? "-" : "+"}
        {formatAmount(intent.amount)} {intent.currency}
      </p>
    </Link>
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
    <span className="inline-flex min-h-7 items-center rounded-full border border-white/10 bg-white/10 px-2.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[#dfffe8]">
      {labels[status]}
    </span>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  actionHref,
  inverted = false,
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  inverted?: boolean;
}) {
  return (
    <div
      className={`rounded-[26px] border border-dashed p-6 ${
        inverted
          ? "border-white/14 bg-white/6 text-[#f3fde8]"
          : "border-black/10 bg-[rgba(245,255,244,0.68)] text-[var(--foreground)]"
      }`}
    >
      <p className="text-base font-bold">{title}</p>
      <p className={`mt-2 text-sm leading-6 ${inverted ? "text-[#a9c8ae]" : "text-[var(--muted)]"}`}>
        {body}
      </p>
      <Link
        href={actionHref}
        className={`${primaryButtonClassName} mt-5 ${inverted ? "focus-visible:ring-offset-[#0b160c]" : ""}`}
      >
        {actionLabel}
      </Link>
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
      {name === "bell" ? (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </>
      ) : null}
      {name === "check" ? <path d="m5 12 5 5L20 7" /> : null}
      {name === "copy" ? (
        <>
          <rect width="13" height="13" x="9" y="9" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      ) : null}
      {name === "dashboard" ? (
        <>
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </>
      ) : null}
      {name === "menu" ? (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      ) : null}
      {name === "settings" ? (
        <>
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6l-.08.12a2 2 0 0 1-3.84 0L10 20a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1l-.12-.08a2 2 0 0 1 0-3.84L4 10a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6l.08-.12a2 2 0 0 1 3.84 0L14 4a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.08.36.28.7.6 1l.12.08a2 2 0 0 1 0 3.84L20 14a1.7 1.7 0 0 0-.6 1Z" />
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
