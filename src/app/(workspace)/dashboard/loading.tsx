import { T } from "@/lib/i18n";

export default function DashboardLoading() {
  return (
    <div className="panel" aria-busy="true" role="status">
      <T id="dashboard.loading" />
    </div>
  );
}
