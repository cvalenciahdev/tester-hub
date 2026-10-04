import Link from "next/link";
import { EmptyHint } from "@/components/ui";
import { T } from "@/lib/i18n";

export default function CampaignNotFound() {
  return (
    <section className="panel">
      <EmptyHint><T id="detail.notAvailable" /></EmptyHint>
      <Link className="back-link" href="/explore"><T id="detail.backToExplore" /></Link>
    </section>
  );
}
