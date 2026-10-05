import { EmptyHint } from "@/components/ui";
import { T } from "@/lib/i18n";
export default function ProfileLoading() { return <section className="panel" role="status" aria-busy="true"><EmptyHint><T id="profile.loading" /></EmptyHint></section>; }
