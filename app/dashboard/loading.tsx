export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-20 sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto grid w-full max-w-[1440px] gap-6 lg:grid-cols-[288px_minmax(0,1fr)]">
        <div className="hidden h-[calc(100vh-48px)] rounded-[32px] border border-white/70 bg-white/60 shadow-[0_24px_70px_rgba(8,17,9,0.08)] lg:block" />
        <div className="grid gap-6">
          <div className="h-16 rounded-full border border-white/70 bg-white/60 shadow-[0_16px_34px_rgba(10,24,10,0.08)]" />
          <section className="rounded-[32px] border border-white/70 bg-white/74 p-8 shadow-[0_24px_80px_rgba(8,17,9,0.08)]">
            <div className="h-4 w-28 rounded-full bg-black/10" />
            <div className="mt-4 h-12 w-full max-w-xl rounded-2xl bg-black/10" />
            <div className="mt-4 h-5 w-full max-w-2xl rounded-full bg-black/10" />
          </section>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="h-36 rounded-[28px] border border-white/70 bg-white/70" />
            <div className="h-36 rounded-[28px] border border-white/70 bg-white/70" />
            <div className="h-36 rounded-[28px] border border-white/70 bg-white/70" />
          </section>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.06fr)_minmax(360px,0.94fr)]">
            <div className="h-80 rounded-[32px] border border-white/70 bg-white/74" />
            <div className="h-80 rounded-[32px] border border-white/70 bg-[#0b160c]/90" />
          </section>
        </div>
      </div>
    </main>
  );
}
