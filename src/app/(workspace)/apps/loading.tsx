import { T } from "@/lib/i18n";
export default function AppsLoading() {
  return <div className="panel" aria-busy="true" role="status"><T id="apps.loading" /></div>;
}
