import { notFound } from "next/navigation";
import { UserRoundCheck } from "lucide-react";
import { Badge, EmptyHint } from "@/components/ui";
import { SetWorkspaceBreadcrumb } from "@/components/workspace-breadcrumb";
import { T } from "@/lib/i18n";
import { getCampaignTracking, trackingStatuses } from "@/lib/campaign-tracking";
import type { ParticipationStatus } from "@/lib/my-tests";
import type { RoundStatus } from "@/lib/app-rounds";
import { ParticipantActions } from "./participant-actions";
import { TrackingDate } from "./tracking-date";
import { ParticipationDetail } from "./participation-detail";

const campaignBadges = { draft: "Draft", recruiting: "Recruiting", testing: "Testing", completed: "Completed", cancelled: "Cancelled" } as const satisfies Record<RoundStatus, string>;
const participationBadges = { waiting_access: "Waiting access", access_enabled: "Access enabled", active: "Active", completed: "Completed", incompatible: "Incompatible", abandoned: "Abandoned", cancelled: "Cancelled" } as const satisfies Record<ParticipationStatus, string>;
export default async function TrackingPage({ params }: PageProps<"/campaigns/[id]/tracking">) {
  const { id } = await params;
  const data = await getCampaignTracking(id);
  if (!data) notFound();
  const campaign = data.campaign;
  const initials = campaign.app_name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  const percent = Math.min(100, Math.round(campaign.covered_testers / campaign.target_testers * 100));
  return <>
    <SetWorkspaceBreadcrumb pathname={`/campaigns/${campaign.campaign_id}/tracking`} workspaceHref="/dashboard" items={[
      { translationKey: "common.myApps", href: "/apps" },
      { label: campaign.app_name, href: `/apps/${campaign.app_id}` },
      { translationKey: "apps.campaigns", href: `/apps/${campaign.app_id}/campaigns` },
      { translationKey: "tracking.breadcrumb" },
    ]} />
    <section className="tracking-overview">
      <div className="panel tracking-campaign"><div className={`app-mark mark-${campaign.platform === "ios" ? "lavender" : "mint"}`}>{initials}</div><div className="tracking-campaign-copy"><h2>{campaign.app_name}</h2><div className="tracking-tags"><Badge status={campaignBadges[campaign.campaign_status]} /><span><T id={campaign.platform === "ios" ? "explore.ios" : "explore.android"} /></span><span><T id="dashboard.durationDays" values={{ count: campaign.duration_days }} /></span></div></div></div>
      <div className="panel tracking-metric"><span className="metric-icon tone-blue"><UserRoundCheck size={18} /></span><div><small><T id="tracking.covered" /></small><strong>{campaign.covered_testers} <span>/ {campaign.target_testers}</span></strong><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><p><T id="apps.roundSlots" values={{ count: campaign.available_slots }} /></p></div></div>
      <div className="panel tracking-metric"><div><small><T id="tracking.pendingAccess" /></small><strong>{campaign.waiting_access_count} <span><T id="common.testers" /></span></strong><p><T id="tracking.waitingApproval" /></p></div></div>
    </section>
    <section className="panel table-panel">
      <div className="tracking-tags" style={{ padding: "16px 24px", flexWrap: "wrap" }}>{trackingStatuses.map((status) => <span key={status}><Badge status={participationBadges[status]} /> {campaign[`${status}_count`]}</span>)}</div>
      {data.participations.length === 0 ? <EmptyHint><T id="tracking.empty" /></EmptyHint> : <div className="table-scroll"><table>
        <thead><tr><th><T id="tracking.tester" /></th><th><T id="common.countries" /></th><th><T id="tracking.joined" /></th><th><T id="common.status" /></th><th><T id="tracking.detail" /></th><th><T id="tracking.action" /></th></tr></thead>
        <tbody>{data.participations.map((row) => {
          const name = row.display_name?.trim() || "—";
          const avatar = row.display_name?.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "—";
          return <tr key={row.participation_id}>
            <td><div className="table-app"><span className="avatar tester-avatar">{avatar}</span><span><strong>{name}</strong><small>{row.testing_email_snapshot}</small></span></div></td>
            <td className="muted-cell">{row.country_code ?? "—"}</td>
            <td className="muted-cell"><TrackingDate value={row.joined_at} /></td>
            <td><Badge status={participationBadges[row.participation_status]} /></td>
            <td><ParticipationDetail participation={row} /></td>
            <td><ParticipantActions campaignId={campaign.campaign_id} participationId={row.participation_id} displayName={name} status={row.participation_status} /></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </>;
}
