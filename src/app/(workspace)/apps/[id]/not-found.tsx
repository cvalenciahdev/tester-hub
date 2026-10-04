import Link from "next/link";
import { EmptyHint } from "@/components/ui";
import { T } from "@/lib/i18n";
export default function AppNotFound() {
  return <section className="panel"><EmptyHint><T id="apps.notAvailable" /></EmptyHint><Link className="back-link" href="/apps"><T id="apps.back" /></Link></section>;
}
