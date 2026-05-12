import { loadDashboardData } from "./dashboard-data";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardPage() {
  const { balances, outstandingIncoming, recentIntents, selectedProfile } =
    await loadDashboardData();

  return (
    <DashboardShell
      profile={selectedProfile}
      balances={balances}
      recentIntents={recentIntents}
      outstandingIncoming={outstandingIncoming}
      view="wallet"
    />
  );
}
