import { T } from "@/lib/i18n";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardPerspectives } from "./dashboard-perspectives";

export default async function DashboardPage() {
  const dashboard = await getDashboardData();
  return (
    <>
      <h1 className="sr-only"><T id="common.dashboard" /></h1>
      <DashboardPerspectives data={dashboard} />
    </>
  );
}
