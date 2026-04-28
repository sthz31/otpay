import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveProfileId } from "@/lib/auth/session-server";
import {
  getProfileById,
  getRecentPaymentIntents,
} from "@/lib/supabase/otpay-queries";
import { LogoutButton } from "./logout-button";

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

export default async function DashboardPage() {
  const activeProfileCookie = await getActiveProfileId();

  if (!activeProfileCookie) {
    redirect("/login");
  }

  const selectedProfile = await getProfileById(activeProfileCookie);

  if (!selectedProfile) {
    redirect("/login");
  }

  const recentIntents = selectedProfile
    ? await getRecentPaymentIntents(selectedProfile.id)
    : [];
  const outstandingIncoming = recentIntents.filter(
    (intent) => intent.recipient_profile_id === selectedProfile?.id && intent.status === "pending",
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white"
        >
          ← Back to landing
        </Link>
        <Link
          href="/request-payment"
          className="primary-dark-button inline-flex w-fit items-center rounded-full px-4 py-2 text-sm font-semibold transition"
        >
          Request payment
        </Link>
        <LogoutButton />
      </div>

      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
        <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Dashboard</p>
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-950">
              OTPay request dashboard
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
              Review your live payment intents, track pending approvals, and jump into
              request creation from one place.
            </p>
          </div>
        </div>
      </section>

      {selectedProfile ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
              <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Profile</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
                {selectedProfile.display_name}
              </h2>
              <p className="mt-2 font-mono text-xs text-zinc-500">
                {selectedProfile.phone_number ?? "No phone linked"}
              </p>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
              <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Wallet</p>
              <p className="mt-3 break-all font-mono text-sm text-zinc-950">
                {selectedProfile.wallet_address}
              </p>
              <p className="mt-3 text-sm text-zinc-600">
                PIN ready: {selectedProfile.pin_set_at ? "Yes" : "No"}
              </p>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-[0_18px_48px_rgba(8,17,9,0.06)]">
              <p className="text-sm uppercase tracking-[0.14em] text-zinc-500">Queue</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                {outstandingIncoming.length}
              </p>
              <p className="mt-2 text-sm text-zinc-600">Pending approvals waiting on this user</p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Pending approvals</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                    Incoming requests
                  </h2>
                </div>
                <Link
                  href="/request-payment"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-lime-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-lime-400"
                >
                  Create a new request
                </Link>
              </div>

              <div className="mt-6 grid gap-4">
                {outstandingIncoming.length ? (
                  outstandingIncoming.map((intent) => (
                    <div
                      key={intent.id}
                      className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-950">
                            {intent.sender_display_name ?? "Unknown sender"} wants{" "}
                            {formatAmount(intent.amount)} {intent.currency}
                          </p>
                          <p className="mt-2 text-sm text-zinc-600">
                            Phone {intent.sender_phone_number ?? "Unavailable"} ·{" "}
                            {formatDate(intent.created_at)}
                          </p>
                          {intent.note ? (
                            <p className="mt-2 text-sm text-zinc-700">“{intent.note}”</p>
                          ) : null}
                        </div>
                        <Link
                          href={`/approve/${intent.id}`}
                          className="dashboard-review-button inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white transition"
                        >
                          Review request
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
                    No pending incoming requests yet. Create one from another profile to
                    test the approval loop.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
              <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Recent activity</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                Sent and received
              </h2>

              <div className="mt-6 grid gap-4">
                {recentIntents.length ? (
                  recentIntents.map((intent) => {
                    const isOutgoing = intent.sender_profile_id === selectedProfile.id;

                    return (
                      <div
                        key={intent.id}
                        className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-950">
                              {isOutgoing ? "Outgoing request to" : "Incoming request from"}{" "}
                              {isOutgoing
                                ? intent.recipient_display_name ?? intent.recipient_phone_number
                                : intent.sender_display_name ?? intent.sender_phone_number}
                            </p>
                            <p className="mt-2 text-sm text-zinc-600">
                              {formatAmount(intent.amount)} {intent.currency} · {intent.status} ·{" "}
                              {formatDate(intent.created_at)}
                            </p>
                            {intent.note ? (
                              <p className="mt-2 text-sm text-zinc-700">“{intent.note}”</p>
                            ) : null}
                          </div>
                          <Link
                            href={
                              intent.status === "pending" && !isOutgoing
                                ? `/approve/${intent.id}`
                                : `/status/${intent.id}`
                            }
                            className={
                              intent.status === "pending" && !isOutgoing
                                ? "dashboard-review-button inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white transition"
                                : "inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
                            }
                          >
                            {intent.status === "pending" && !isOutgoing ? "Open approval" : "View status"}
                          </Link>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
                    No requests yet for this profile. Use the request payment flow to
                    seed the dashboard.
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-[28px] border border-lime-200 bg-lime-50 p-5 text-sm text-lime-950">
                <p className="font-semibold">Hackathon-ready dashboard path</p>
                <p className="mt-2">
                  Register two users, request a payment from one to the other, then use
                  the incoming queue above to open the approval screen.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_64px_rgba(8,17,9,0.08)]">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            No demo profiles yet
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            Start by registering a phone number, verifying OTP, and setting a PIN.
            Once a profile exists, the dashboard will populate automatically.
          </p>
          <div className="mt-6">
            <Link
              href="/link-phone"
              className="primary-dark-button inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
            >
              Register first profile
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
