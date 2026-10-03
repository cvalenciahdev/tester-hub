import Link from "next/link";
import { Check, CircleHelp, ExternalLink, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { campaigns, participations } from "@/lib/mock-data";
import type { ParticipationStatus } from "@/lib/mock-data";
import { Badge, PageHeading } from "@/components/ui";
import { T, TranslatedIconButton, type TranslationKey } from "@/lib/i18n";

const actionForStatus: Record<ParticipationStatus, { label: TranslationKey; icon: LucideIcon; href: string }> = {
  "Waiting access": { label: "common.viewDetails", icon: CircleHelp, href: "/explore/pocket-garden" },
  "Access enabled": { label: "tests.confirmInstall", icon: Check, href: "/explore/luma-learn" },
  Active: { label: "tests.completeTest", icon: Check, href: "/explore/trail-notes" },
  Completed: { label: "tests.viewTest", icon: ExternalLink, href: "/explore/finch-wallet" },
  Incompatible: { label: "common.viewDetails", icon: CircleHelp, href: "/explore/pocket-garden" },
  Abandoned: { label: "common.viewDetails", icon: ExternalLink, href: "/explore/trail-notes" },
  Cancelled: { label: "common.viewDetails", icon: ExternalLink, href: "/explore/luma-learn" },
};

export default function MyTestsPage() {
  return (
    <>
      <PageHeading eyebrow={<T id="tests.eyebrow" />} title={<T id="tests.title" />} description={<T id="tests.description" />} />
      <div className="test-summary-strip"><div><span className="summary-dot dot-blue" /><strong>3</strong><span><T id="tests.inProgress" /></span></div><div><span className="summary-dot dot-amber" /><strong>1</strong><span><T id="dashboard.waitingAccess" /></span></div><div><span className="summary-dot dot-green" /><strong>1</strong><span><T id="tests.completed" /></span></div></div>
      <section className="panel table-panel">
        <div className="table-toolbar"><div><h2><T id="tests.allParticipations" /></h2><p><T id="tests.pastAndCurrent" /></p></div><label className="sr-only" htmlFor="participation-status-filter"><T id="tests.filterStatus" /></label><select id="participation-status-filter" defaultValue="all"><option value="all"><T id="tests.allStatuses" /></option><option value="progress"><T id="tests.inProgress" /></option><option value="waiting"><T id="dashboard.waitingAccess" /></option><option value="completed"><T id="tests.completed" /></option></select></div>
        <div className="table-scroll"><table><thead><tr><th><T id="campaigns.name" /></th><th><T id="campaigns.status" /></th><th><T id="tests.ending" /></th><th><T id="tests.action" /></th><th /></tr></thead><tbody>
          {participations.map((participation, index) => {
            const campaign = campaigns.find((item) => item.id === participation.campaignId)!;
            const action = actionForStatus[participation.status];
            const ActionIcon = action.icon;
            return <tr key={`${participation.campaignId}-${participation.status}`}><td><div className="table-app"><span className={`app-mark app-mark-small mark-${campaign.color}`}>{campaign.icon}</span><span><strong>{campaign.name}</strong><small>{campaign.app} · {campaign.platform}</small></span></div></td><td><Badge status={participation.status} /></td><td className="muted-cell">{participation.endDate}</td><td><div className="participation-actions"><Link className={`row-action ${index < 3 ? "row-action-strong" : ""}`} href={action.href}><ActionIcon size={14} /><T id={action.label} /></Link>{participation.status === "Access enabled" && <button className="row-action" type="button"><T id="tests.markIncompatible" /></button>}{participation.status === "Active" && <button className="row-action" type="button"><T id="tests.abandon" /></button>}</div></td><td><TranslatedIconButton label="tests.moreOptionsFor" values={{ name: campaign.name }} className="dots-button"><MoreHorizontal size={18} /></TranslatedIconButton></td></tr>;
          })}
        </tbody></table></div>
      </section>
      <div className="demo-note"><T id="tests.demoActions" /></div>
    </>
  );
}
