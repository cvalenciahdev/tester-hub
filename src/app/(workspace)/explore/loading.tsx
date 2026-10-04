import { T } from "@/lib/i18n";
export default function ExploreLoading() {
  return <div className="panel" aria-busy="true" role="status"><T id="explore.loading" /></div>;
}
