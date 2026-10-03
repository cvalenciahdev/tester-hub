import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Rocket,
  Users,
} from "lucide-react";
import { campaigns, participations } from "@/lib/mock-data";
import { Badge, CampaignCard, PageHeading, StatCard } from "@/components/ui";
import { T, type TranslationKey } from "@/lib/i18n";

const activity: { initials: string; color: string; text: TranslationKey; time: TranslationKey }[] = [
  { initials: "SL", color: "peach", text: "activity.sofia", time: "activity.12min" },
  { initials: "✓", color: "mint", text: "activity.trailNotes", time: "activity.1hour" },
  { initials: "MR", color: "lavender", text: "activity.mateo", time: "activity.yesterday" },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow={<T id="dashboard.date" />}
        title={<T id="dashboard.greeting" />}
        description={<T id="dashboard.description" />}
      />
      <section className="developer-callout"><div className="callout-icon"><Rocket size={20} /></div><div><strong><T id="dashboard.developerTitle" /></strong><p><T id="dashboard.developerDescription" /></p></div><Link className="button button-secondary button-small" href="/apps"><T id="dashboard.configureApp" /> <ArrowRight size={15} /></Link></section>
      <section className="stats-grid">
        <StatCard label={<T id="dashboard.activeCampaigns" />} value="4" note={<><span className="trend-up">+1</span> <T id="dashboard.thisWeek" /></>} icon={FlaskConical} tone="blue" />
        <StatCard label={<T id="dashboard.myTests" />} value="3" note={<T id="dashboard.needsAttention" />} icon={CheckCircle2} tone="mint" />
        <StatCard label={<T id="dashboard.waitingAccess" />} value="2" note={<T id="dashboard.inCampaigns" />} icon={Clock3} tone="amber" />
        <StatCard label={<T id="dashboard.activeTesters" />} value="38" note={<T id="dashboard.inAllCampaigns" />} icon={Users} tone="violet" />
        <StatCard label={<T id="dashboard.completedCampaigns" />} value="12" note={<T id="dashboard.completedThisMonth" />} icon={CheckCircle2} tone="mint" />
      </section>
      <section className="dashboard-grid">
        <div className="panel campaigns-panel">
          <div className="panel-heading"><div><h2><T id="dashboard.testsInProgress" /></h2><p><T id="dashboard.continueWhereLeft" /></p></div><Link className="button button-secondary button-small" href="/my-tests"><T id="common.viewAll" /> <ArrowRight size={15} /></Link></div>
          <div className="in-progress-list">
            {participations.slice(0, 3).map((participation, index) => {
              const campaign = campaigns.find((item) => item.id === participation.campaignId)!;
              const value = [62, 0, 28][index];
              return <div className="in-progress-row" key={`${participation.campaignId}-${participation.status}`}>
                <div className={`app-mark mark-${campaign.color}`}>{campaign.icon}</div>
                <div className="in-progress-main"><strong>{campaign.name}</strong><span>{campaign.app} · <T id="tests.finalizes" /> {participation.endDate}</span><div className="mini-progress"><span style={{ width: `${value}%` }} /></div></div>
                <Badge status={participation.status} />
              </div>;
            })}
          </div>
        </div>
        <div className="panel activity-panel">
          <div className="panel-heading"><div><h2><T id="dashboard.recentActivity" /></h2><p><T id="dashboard.spaceUpdates" /></p></div><Link className="button button-secondary button-small" href="/campaigns"><T id="dashboard.viewActivity" /> <ArrowRight size={15} /></Link></div>
          <div className="activity-list">{activity.map((item) => <div className="activity-item" key={item.initials + item.time}><div className={`avatar activity-avatar avatar-${item.color}`}>{item.initials}</div><div className="activity-copy"><p><T id={item.text} /></p><span><T id={item.time} /></span></div></div>)}</div>
        </div>
      </section>
      <section className="panel explore-panel">
        <div className="panel-heading"><div><div className="eyebrow"><T id="dashboard.findNextTest" /></div><h2><T id="dashboard.campaignsForYou" /></h2><p><T id="dashboard.recommendations" /></p></div><Link className="button button-secondary button-small" href="/explore"><T id="dashboard.exploreAll" /> <ArrowRight size={15} /></Link></div>
        <div className="campaign-grid campaign-grid-dashboard">{campaigns.slice(0, 3).map((campaign) => <CampaignCard campaign={campaign} key={campaign.id} />)}</div>
      </section>
    </>
  );
}
