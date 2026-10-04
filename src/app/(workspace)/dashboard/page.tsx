import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Rocket,
  Users,
} from "lucide-react";
import { Badge, EmptyHint, PageHeading, StatCard } from "@/components/ui";
import { T, type TranslationKey } from "@/lib/i18n";
import type { ParticipationStatus } from "@/lib/mock-data";
import { getDashboardData, type DashboardData } from "@/lib/dashboard";
import { DashboardCampaignCard } from "./dashboard-campaign-card";
import { DashboardGreeting, DashboardTimestamp } from "./dashboard-timestamp";

const participationStatuses: Record<
  DashboardData["tests"][number]["status"],
  ParticipationStatus
> = {
  waiting_access: "Waiting access",
  access_enabled: "Access enabled",
  active: "Active",
};

const activityKeys: Record<string, { own: TranslationKey; campaign: TranslationKey }> = {
  joined: {
    own: "dashboard.event.joined.own",
    campaign: "dashboard.event.joined.campaign",
  },
  access_enabled: {
    own: "dashboard.event.access.own",
    campaign: "dashboard.event.access.campaign",
  },
  installation_confirmed: {
    own: "dashboard.event.install.own",
    campaign: "dashboard.event.install.campaign",
  },
  completed: {
    own: "dashboard.event.completed.own",
    campaign: "dashboard.event.completed.campaign",
  },
  marked_incompatible: {
    own: "dashboard.event.incompatible.own",
    campaign: "dashboard.event.incompatible.campaign",
  },
  abandoned: {
    own: "dashboard.event.abandoned.own",
    campaign: "dashboard.event.abandoned.campaign",
  },
  cancelled: {
    own: "dashboard.event.cancelled.own",
    campaign: "dashboard.event.cancelled.campaign",
  },
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default async function DashboardPage() {
  const dashboard = await getDashboardData();

  return (
    <>
      <PageHeading
        eyebrow={<T id="dashboard.eyebrow" />}
        title={<DashboardGreeting name={dashboard.display_name} />}
        description={<T id="dashboard.description" />}
      />
      <section className="developer-callout"><div className="callout-icon"><Rocket size={20} /></div><div><strong><T id="dashboard.developerTitle" /></strong><p><T id="dashboard.developerDescription" /></p></div><Link className="button button-secondary button-small" href="/apps"><T id="dashboard.configureApp" /> <ArrowRight size={15} /></Link></section>
      <section className="stats-grid">
        <StatCard label={<T id="dashboard.activeCampaigns" />} value={dashboard.metrics.active_campaigns} note={<T id="dashboard.activeCampaignsNote" />} icon={FlaskConical} tone="blue" />
        <StatCard label={<T id="dashboard.myTests" />} value={dashboard.metrics.my_tests} note={<T id="dashboard.myTestsNote" />} icon={CheckCircle2} tone="mint" />
        <StatCard label={<T id="dashboard.waitingAccess" />} value={dashboard.metrics.waiting_for_access} note={<T id="dashboard.waitingAccessNote" />} icon={Clock3} tone="amber" />
        <StatCard label={<T id="dashboard.activeTesters" />} value={dashboard.metrics.active_testers} note={<T id="dashboard.activeTestersNote" />} icon={Users} tone="violet" />
        <StatCard label={<T id="dashboard.completedCampaigns" />} value={dashboard.metrics.completed_campaigns} note={<T id="dashboard.completedCampaignsNote" />} icon={CheckCircle2} tone="mint" />
      </section>
      <section className="dashboard-grid">
        <div className="panel campaigns-panel">
          <div className="panel-heading"><div><h2><T id="dashboard.testsInProgress" /></h2><p><T id="dashboard.continueWhereLeft" /></p></div><Link className="button button-secondary button-small" href="/my-tests"><T id="common.viewAll" /> <ArrowRight size={15} /></Link></div>
          <div className="in-progress-list">
            {dashboard.tests.length === 0 ? (
              <EmptyHint><T id="dashboard.noTests" /></EmptyHint>
            ) : dashboard.tests.map((test) => (
              <div className="in-progress-row" key={test.participation_id}>
                <div className="app-mark mark-mint">{getInitials(test.app_name)}</div>
                <div className="in-progress-main">
                  <strong>{test.app_name}</strong>
                  <span>
                    <T id="dashboard.durationDays" values={{ count: test.duration_days }} />
                    {test.expected_end_at && <> · <T id="tests.finalizes" /> <DashboardTimestamp value={test.expected_end_at} dateOnly /></>}
                  </span>
                  {test.progress_percent !== null && <div className="mini-progress"><span style={{ width: `${test.progress_percent}%` }} /></div>}
                </div>
                <Badge status={participationStatuses[test.status]} />
              </div>
            ))}
          </div>
        </div>
        <div className="panel activity-panel">
          <div className="panel-heading"><div><h2><T id="dashboard.recentActivity" /></h2><p><T id="dashboard.spaceUpdates" /></p></div><Link className="button button-secondary button-small" href="/campaigns"><T id="dashboard.viewActivity" /> <ArrowRight size={15} /></Link></div>
          <div className="activity-list">
            {dashboard.recent_activity.length === 0 ? (
              <EmptyHint><T id="dashboard.noActivity" /></EmptyHint>
            ) : dashboard.recent_activity.map((event, index) => {
              const eventKeysForType = activityKeys[event.event_type];
              const textKey =
                eventKeysForType?.[event.is_own_participation ? "own" : "campaign"] ??
                (event.is_own_participation
                  ? "dashboard.event.update.own"
                  : "dashboard.event.update.campaign");

              return (
                <div className="activity-item" key={`${event.campaign_id}-${event.created_at}-${index}`}>
                  <div className={`avatar activity-avatar avatar-${event.is_own_participation ? "mint" : "lavender"}`}>✓</div>
                  <div className="activity-copy">
                    <p><T id={textKey} values={{ app: event.app_name }} /></p>
                    <span><DashboardTimestamp value={event.created_at} /></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="panel explore-panel">
        <div className="panel-heading"><div><div className="eyebrow"><T id="dashboard.findNextTest" /></div><h2><T id="dashboard.campaignsForYou" /></h2><p><T id="dashboard.recommendations" /></p></div><Link className="button button-secondary button-small" href="/explore"><T id="dashboard.exploreAll" /> <ArrowRight size={15} /></Link></div>
        {dashboard.campaigns_for_you.length === 0 ? (
          <EmptyHint><T id="dashboard.noCampaigns" /></EmptyHint>
        ) : (
          <div className="campaign-grid campaign-grid-dashboard">
            {dashboard.campaigns_for_you.map((campaign) => (
              <DashboardCampaignCard campaign={campaign} key={campaign.campaign_id} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
