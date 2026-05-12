import { loadDashboardData } from "@/app/dashboard/dashboard-data";
import { DashboardShell } from "@/app/dashboard/dashboard-shell";

export default async function RequestsPage() {
  const { balances, outstandingIncoming, recentIntents, selectedProfile } =
    await loadDashboardData();

  return (
    <DashboardShell
      profile={selectedProfile}
      balances={balances}
      recentIntents={recentIntents}
      outstandingIncoming={outstandingIncoming}
      view="requests"
    />
  );
}
