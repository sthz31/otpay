"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12">
      <section className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white/84 p-8 shadow-[0_24px_80px_rgba(8,17,9,0.09)]">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Dashboard unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
          We could not load your OTPay dashboard.
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          {error.message || "Try again in a moment. Your wallet and payment data were not changed."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--surface-strong)] px-5 text-sm font-bold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          Retry dashboard
        </button>
      </section>
    </main>
  );
}
