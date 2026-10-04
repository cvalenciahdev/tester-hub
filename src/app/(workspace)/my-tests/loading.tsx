import { T } from "@/lib/i18n";
export default function MyTestsLoading() {
  return <div className="panel" aria-busy="true" role="status"><T id="tests.loading" /></div>;
}
