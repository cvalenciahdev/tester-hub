"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, FlaskConical, MessageSquare, Rocket, Users } from "lucide-react";
import { Badge, EmptyHint, StatCard } from "@/components/ui";
import { T, useI18n, type TranslationKey } from "@/lib/i18n";
import type { DashboardActivity, DashboardData } from "@/lib/dashboard";
import { DashboardCampaignCard } from "./dashboard-campaign-card";
import { DashboardTimestamp } from "./dashboard-timestamp";
import styles from "./dashboard-perspectives.module.css";

type Perspective = "tester" | "developer";
const perspectives: Perspective[] = ["tester", "developer"];
const participationStatuses = { waiting_access: "Waiting access", access_enabled: "Access enabled", active: "Active" } as const;
const activityKeys: Record<string, { own: TranslationKey; campaign: TranslationKey }> = {
  joined: { own: "dashboard.event.joined.own", campaign: "dashboard.event.joined.campaign" },
  access_enabled: { own: "dashboard.event.access.own", campaign: "dashboard.event.access.campaign" },
  installation_confirmed: { own: "dashboard.event.install.own", campaign: "dashboard.event.install.campaign" },
  completed: { own: "dashboard.event.completed.own", campaign: "dashboard.event.completed.campaign" },
  marked_incompatible: { own: "dashboard.event.incompatible.own", campaign: "dashboard.event.incompatible.campaign" },
  abandoned: { own: "dashboard.event.abandoned.own", campaign: "dashboard.event.abandoned.campaign" },
  cancelled: { own: "dashboard.event.cancelled.own", campaign: "dashboard.event.cancelled.campaign" },
};

function Activity({ events, perspective }: { events: DashboardActivity[]; perspective: Perspective }) {
  const own = perspective === "tester";
  return (
    <div className={`panel activity-panel ${styles.activity}`}>
      <div className="panel-heading"><h2><T id={own ? "dashboard.testerActivity" : "dashboard.developerActivity"} /></h2></div>
      <div className="activity-list">
        {events.length === 0 ? <EmptyHint><T id="dashboard.noActivity" /></EmptyHint> : events.map((event, index) => {
          const textKey = activityKeys[event.event_type]?.[own ? "own" : "campaign"] ??
            (own ? "dashboard.event.update.own" : "dashboard.event.update.campaign");
          return (
            <div className="activity-item" key={`${event.campaign_id}-${event.created_at}-${index}`}>
              <div className={`avatar activity-avatar avatar-${own ? "mint" : "lavender"}`}><CheckCircle2 size={16} /></div>
              <div className="activity-copy"><p><T id={textKey} values={{ app: event.app_name }} /></p><span><DashboardTimestamp value={event.created_at} /></span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardPerspectives({ data }: { data: DashboardData }) {
  const [perspective, setPerspective] = useState<Perspective>(data.initial_intent === "developer" ? "developer" : "tester");
  const { t } = useI18n();
  const metrics = data.metrics;

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, current: Perspective) {
    const index = perspectives.indexOf(current);
    const next = event.key === "ArrowRight" ? perspectives[(index + 1) % perspectives.length] :
      event.key === "ArrowLeft" ? perspectives[(index + perspectives.length - 1) % perspectives.length] :
      event.key === "Home" ? "tester" : event.key === "End" ? "developer" : null;
    if (!next) return;
    event.preventDefault();
    setPerspective(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#dashboard-tab-${next}`)?.focus();
  }

  return (
    <div className={styles.content}>
      <div className={styles.tabs} role="tablist" aria-label={t("dashboard.perspectives")}>
        {perspectives.map((item) => (
          <button key={item} type="button" role="tab" id={`dashboard-tab-${item}`} aria-controls={`dashboard-panel-${item}`}
            aria-selected={perspective === item} tabIndex={perspective === item ? 0 : -1}
            className={styles.tab} onClick={() => setPerspective(item)} onKeyDown={(event) => navigateTabs(event, item)}>
            <T id={item === "tester" ? "dashboard.testerTab" : "dashboard.developerTab"} />
          </button>
        ))}
      </div>
      <section role="tabpanel" id="dashboard-panel-tester" aria-labelledby="dashboard-tab-tester" hidden={perspective !== "tester"}>
        <section className={`stats-grid ${styles.metrics}`}>
          <StatCard label={<T id="dashboard.testerActiveTests" />} value={metrics.tester_active_tests} note={<T id="dashboard.inProgressNote" />} icon={CheckCircle2} tone="mint" />
          <StatCard label={<T id="dashboard.testerWaitingAccess" />} value={metrics.waiting_for_access} note={<T id="dashboard.waitingAccessNote" />} icon={Clock3} tone="amber" />
          <StatCard label={<T id="dashboard.feedbackPending" />} value={metrics.feedback_pending} note={<T id="dashboard.feedbackPendingNote" />} icon={MessageSquare} tone="violet" />
          <StatCard label={<T id="dashboard.readyToComplete" />} value={metrics.ready_to_complete} note={<T id="dashboard.readyToCompleteNote" />} icon={CheckCircle2} tone="blue" />
        </section>
        <section className="dashboard-grid">
          <div className="panel campaigns-panel">
            <div className="panel-heading"><div><h2><T id="dashboard.testsInProgress" /></h2><p><T id="dashboard.continueWhereLeft" /></p></div><Link className="button button-secondary button-small" href="/my-tests"><T id="common.viewAll" /> <ArrowRight size={15} /></Link></div>
            <div className="in-progress-list">
              {data.tests.length === 0 ? <EmptyHint><T id="dashboard.noTests" /></EmptyHint> : data.tests.map((test) => (
                <div className="in-progress-row" key={test.participation_id}>
                  <div className="app-mark mark-mint">{test.app_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
                  <div className="in-progress-main">
                    <strong>{test.app_name}</strong>
                    <span><T id="dashboard.durationDays" values={{ count: test.duration_days }} />{test.expected_end_at && <> · <T id="tests.finalizes" /> <DashboardTimestamp value={test.expected_end_at} dateOnly /></>}</span>
                    {test.progress_percent !== null && <div className="mini-progress"><span style={{ width: `${test.progress_percent}%` }} /></div>}
                  </div>
                  <Badge status={participationStatuses[test.status]} />
                </div>
              ))}
            </div>
          </div>
          <Activity events={data.recent_activity.tester} perspective="tester" />
        </section>
        <section className="panel explore-panel">
          <div className="panel-heading"><div><div className="eyebrow"><T id="dashboard.findNextTest" /></div><h2><T id="dashboard.campaignsForYou" /></h2><p><T id="dashboard.discoveryNote" /></p></div><Link className="button button-secondary button-small" href="/explore"><T id="dashboard.exploreAll" /> <ArrowRight size={15} /></Link></div>
          {data.campaigns_for_you.length === 0 ? <EmptyHint><T id="dashboard.noCampaigns" /></EmptyHint> : (
            <div className="campaign-grid campaign-grid-dashboard">{data.campaigns_for_you.map((campaign) => <DashboardCampaignCard campaign={campaign} key={campaign.campaign_id} />)}</div>
          )}
        </section>
      </section>
      <section role="tabpanel" id="dashboard-panel-developer" aria-labelledby="dashboard-tab-developer" hidden={perspective !== "developer"}>
        <section className={`developer-callout ${styles.callout}`}><div className="callout-icon"><Rocket size={20} /></div><div><strong><T id="dashboard.developerTitle" /></strong><p><T id="dashboard.developerDescription" /></p></div><Link className="button button-secondary button-small" href="/apps/new"><T id="dashboard.configureApp" /> <ArrowRight size={15} /></Link></section>
        <section className={`stats-grid ${styles.metrics}`}>
          <StatCard label={<T id="dashboard.ownerActiveCampaigns" />} value={metrics.active_campaigns} note={<T id="dashboard.activeCampaignsNote" />} icon={FlaskConical} tone="blue" />
          <StatCard label={<T id="dashboard.ownerWaitingAccess" />} value={metrics.owner_waiting_access} note={<T id="dashboard.activeTestersNote" />} icon={Clock3} tone="amber" />
          <StatCard label={<T id="dashboard.ownerTestersInProgress" />} value={metrics.owner_testers_in_progress} note={<T id="dashboard.inProgressNote" />} icon={Users} tone="violet" />
          <StatCard label={<T id="dashboard.completedCampaigns" />} value={metrics.completed_campaigns} note={<T id="dashboard.completedCampaignsNote" />} icon={CheckCircle2} tone="mint" />
        </section>
        <Activity events={data.recent_activity.developer} perspective="developer" />
      </section>
    </div>
  );
}
