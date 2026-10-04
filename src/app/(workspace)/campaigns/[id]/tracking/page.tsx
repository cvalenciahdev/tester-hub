import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserRoundCheck } from "lucide-react";
import { Badge, EmptyHint, PageHeading } from "@/components/ui";
import { T } from "@/lib/i18n";
import { getCampaignTracking, trackingStatuses } from "@/lib/campaign-tracking";
import type { ParticipationStatus } from "@/lib/my-tests";
import type { RoundStatus } from "@/lib/app-rounds";
import { ParticipantActions } from "./participant-actions";
import { TrackingDate } from "./tracking-date";

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
    <Link className="back-link" href={`/apps/${campaign.app_id}`}><ArrowLeft size={16} /><T id="roundForm.back" /></Link>
    <PageHeading eyebrow={<T id="tracking.eyebrow" values={{ app: campaign.app_name.toUpperCase() }} />} title={campaign.app_name} description={<T id="tracking.description" />} action={<Link className="button button-secondary" href={`/campaigns/${campaign.campaign_id}/edit`}><T id={campaign.campaign_status === "completed" || campaign.campaign_status === "cancelled" ? "roundForm.edit" : "tracking.editCampaign"} /></Link>} />
    <section className="tracking-overview">
      <div className="panel tracking-campaign"><div className={`app-mark mark-${campaign.platform === "ios" ? "lavender" : "mint"}`}>{initials}</div><div className="tracking-campaign-copy"><div className="campaign-category">{campaign.campaign_id}</div><h2>{campaign.app_name}</h2><div className="tracking-tags"><Badge status={campaignBadges[campaign.campaign_status]} /><span><T id={campaign.platform === "ios" ? "explore.ios" : "explore.android"} /></span><span><T id="dashboard.durationDays" values={{ count: campaign.duration_days }} /></span></div></div></div>
      <div className="panel tracking-metric"><span className="metric-icon tone-blue"><UserRoundCheck size={18} /></span><div><small><T id="tracking.covered" /></small><strong>{campaign.covered_testers} <span>/ {campaign.target_testers}</span></strong><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><p><T id="apps.roundSlots" values={{ count: campaign.available_slots }} /></p></div></div>
      <div className="panel tracking-metric"><div><small><T id="tracking.pendingAccess" /></small><strong>{campaign.waiting_access_count} <span><T id="common.testers" /></span></strong><p><T id="tracking.waitingApproval" /></p></div></div>
    </section>
    <section className="panel table-panel">
      <div className="table-toolbar"><div><h2><T id="tracking.participants" /></h2><p><T id="tracking.total" values={{ count: campaign.total_participations }} /></p><p><T id="tracking.countryNote" /></p></div></div>
      <div className="tracking-tags" style={{ padding: "0 24px 16px", flexWrap: "wrap" }}>{trackingStatuses.map((status) => <span key={status}><Badge status={participationBadges[status]} /> {campaign[`${status}_count`]}</span>)}</div>
      {data.participations.length === 0 ? <EmptyHint><T id="tracking.empty" /></EmptyHint> : <div className="table-scroll"><table>
        <thead><tr><th><T id="tracking.tester" /></th><th><T id="common.countries" /></th><th><T id="tracking.joined" /></th><th><T id="common.status" /></th><th><T id="tracking.dates" /></th><th><T id="tracking.action" /></th></tr></thead>
        <tbody>{data.participations.map((row) => {
          const name = row.display_name?.trim() || row.tester_id;
          const avatar = row.display_name?.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "—";
          return <tr key={row.participation_id}>
            <td><div className="table-app"><span className="avatar tester-avatar">{avatar}</span><span><strong>{name}</strong><small>{row.testing_email_snapshot}</small></span></div></td>
            <td className="muted-cell">{row.country_code ?? "—"}</td>
            <td className="muted-cell"><TrackingDate value={row.joined_at} /></td>
            <td><Badge status={participationBadges[row.participation_status]} /></td>
            <td className="muted-cell"><details><summary><T id="tracking.dates" /></summary><dl>
              <dt><T id="tracking.accessDate" /></dt><dd><TrackingDate value={row.access_enabled_at} /></dd>
              <dt><T id="tracking.installDate" /></dt><dd><TrackingDate value={row.installed_at} /></dd>
              <dt><T id="tracking.endDate" /></dt><dd><TrackingDate value={row.expected_end_at} /></dd>
              <dt><T id="tracking.closeDate" /></dt><dd><TrackingDate value={row.closed_at} /></dd>
              {row.close_reason !== null && <><dt><T id="tracking.closeReason" /></dt><dd>{row.close_reason}</dd></>}
            </dl></details></td>
            <td><ParticipantActions campaignId={campaign.campaign_id} participationId={row.participation_id} status={row.participation_status} /></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </>;
}
