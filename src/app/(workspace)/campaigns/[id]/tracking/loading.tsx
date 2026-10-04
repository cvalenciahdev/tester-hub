import { EmptyHint } from "@/components/ui";
import { T } from "@/lib/i18n";
export default function TrackingLoading() {
  return <section className="panel" aria-busy="true" role="status"><EmptyHint><T id="tracking.loading" /></EmptyHint></section>;
}
