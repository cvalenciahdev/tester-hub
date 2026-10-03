import Link from "next/link";
import { ArrowLeft, Download, MoreHorizontal, UserRoundCheck } from "lucide-react";
import { myCampaigns, testers } from "@/lib/mock-data";
import { Badge, PageHeading } from "@/components/ui";
import { T, TranslatedIconButton } from "@/lib/i18n";

export function generateStaticParams() {
  return myCampaigns.map(({ id }) => ({ id }));
}

export default async function TrackingPage({ params }: PageProps<"/campaigns/[id]/tracking">) {
  const { id } = await params;
  const campaign = myCampaigns.find((item) => item.id === id);
  if (!campaign) {
    return <div className="panel not-found-card"><h1><T id="tracking.notFound" /></h1><Link href="/campaigns"><T id="tracking.back" /></Link></div>;
  }
  return (
    <>
      <Link className="back-link" href="/campaigns"><ArrowLeft size={16} /> <T id="tracking.back" /></Link>
      <PageHeading eyebrow={<T id="tracking.eyebrow" values={{ app: campaign.app.toUpperCase() }} />} title={campaign.name} description={<T id="tracking.description" />} action={<Link className="button button-secondary" href="/campaigns/new"><T id="tracking.editCampaign" /></Link>} />
      <section className="tracking-overview">
        <div className="panel tracking-campaign"><div className={`app-mark mark-${campaign.color}`}>{campaign.icon}</div><div className="tracking-campaign-copy"><div className="campaign-category">{campaign.app}</div><h2>{campaign.name}</h2><div className="tracking-tags"><Badge status={campaign.status} /><span>{campaign.platform}</span><span>{campaign.duration}</span></div></div></div>
        <div className="panel tracking-metric"><span className="metric-icon tone-blue"><UserRoundCheck size={18} /></span><div><small><T id="tracking.joinedTesters" /></small><strong>{campaign.covered} <span>/ {campaign.target}</span></strong><div className="progress-track"><span style={{ width: `${Math.round((campaign.covered / campaign.target) * 100)}%` }} /></div></div></div>
        <div className="panel tracking-metric"><div><small><T id="tracking.pendingAccess" /></small><strong>2 <span><T id="common.testers" /></span></strong><p><T id="tracking.waitingApproval" /></p></div></div>
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar"><div><h2><T id="tracking.participants" /></h2><p><T id="tracking.contactMock" /></p></div><button className="button button-secondary button-small"><Download size={15} /> <T id="tracking.export" /></button></div>
        <div className="table-scroll"><table><thead><tr><th>TESTER</th><th><T id="tracking.device" /></th><th><T id="tracking.joined" /></th><th><T id="common.status" /></th><th><T id="tracking.action" /></th><th /></tr></thead><tbody>
          {testers.map((tester) => <tr key={tester.email}><td><div className="table-app"><span className="avatar tester-avatar">{tester.initials}</span><span><strong>{tester.name}</strong><small>{tester.email}</small></span></div></td><td><div className="device-cell">{tester.device}<small>{tester.country}</small></div></td><td className="muted-cell">{tester.date}</td><td><Badge status={tester.status} /></td><td><div className="participant-actions">{tester.status === "Waiting access" && <button className="row-action row-action-strong" type="button"><T id="tracking.enableAccess" /></button>}<button className="row-action" type="button"><T id="tracking.viewParticipation" /></button>{tester.status !== "Completed" && <button className="row-action row-action-muted" type="button"><T id="tracking.cancelParticipation" /></button>}</div></td><td><TranslatedIconButton label="tracking.participantOptions" values={{ name: tester.name }} className="dots-button"><MoreHorizontal size={18} /></TranslatedIconButton></td></tr>)}
        </tbody></table></div>
      </section>
      <div className="demo-note"><T id="tracking.demoActions" /></div>
    </>
  );
}
