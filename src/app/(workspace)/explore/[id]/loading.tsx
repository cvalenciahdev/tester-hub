import { T } from "@/lib/i18n";

export default function DetailLoading() {
  return <div className="panel" aria-busy="true" role="status"><T id="detail.loading" /></div>;
}
