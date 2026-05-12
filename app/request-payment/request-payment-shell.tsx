"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ProfileSummary } from "@/lib/supabase/otpay-queries";
import { LogoutButton } from "@/app/dashboard/logout-button";

type RequestPaymentShellProps = {
  activeProfile: ProfileSummary;
  children: React.ReactNode;
};

type IconName = "activity" | "menu" | "plus" | "shield" | "user" | "wallet" | "x";

const navigation = [
  { label: "Wallet", href: "/dashboard", icon: "wallet" },
  { label: "Pay requests", href: "/requests", icon: "shield" },
  { label: "Request", href: "/request-payment", icon: "plus" },
  { label: "Activity", href: "/activity", icon: "activity" },
  { label: "Profile", href: "/profile", icon: "user" },
] satisfies { label: string; href: string; icon: IconName }[];

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

export function RequestPaymentShell({ activeProfile, children }: RequestPaymentShellProps) {
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
        profileName={activeProfile.display_name}
        onOpen={() => setDrawerOpen(true)}
      />
      <MobileNavDrawer
        activeNavLabel={activeNavLabel}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        profile={activeProfile}
      />

      <div className="mx-auto grid h-full w-full max-w-[1440px] overflow-hidden lg:grid-cols-[244px_minmax(0,1fr)]">
        <Sidebar activeNavLabel={activeNavLabel} profile={activeProfile} />

        <main className="flex h-full min-w-0 flex-col overflow-hidden lg:p-4">
          <header className="hidden min-h-16 shrink-0 items-center justify-between gap-4 rounded-full border border-white/70 bg-white/76 px-5 shadow-[0_16px_34px_rgba(10,24,10,0.08)] backdrop-blur lg:flex">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">New request</p>
              <p className="text-xs font-medium text-[var(--muted)]">
                Ask a verified phone number for USDC.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/10 bg-white/64 px-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              Dashboard
            </Link>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-20 sm:px-6 lg:mt-4 lg:px-4 lg:pt-0">
            {children}
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
            New request
          </p>
          <p className="mt-2 text-sm font-bold text-[var(--foreground)]">Phone to USDC</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Create a request, enter the OTP, and settle on devnet.
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
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
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
