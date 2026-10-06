import Link from "next/link";
import { ArrowRight, Plus, Smartphone, Users } from "lucide-react";
import { Badge, EmptyHint } from "@/components/ui";
import { T } from "@/lib/i18n";
import { getAppsData, parseAppsFilter } from "@/lib/apps";
import { AppArchivedAt, AppsFilterControl } from "./apps-controls";
import styles from "./apps-overview.module.css";
import cardStyles from "./app-card.module.css";

export default async function AppsPage({ searchParams }: PageProps<"/apps">) {
  const filter = parseAppsFilter((await searchParams).status);
  const data = await getAppsData();
  const apps = data.apps.filter((app) => filter === "all" || (filter === "active" ? app.archived_at === null : app.archived_at !== null));
  return (
    <>
      <h1 className="sr-only"><T id="apps.title" /></h1>
      <div className={`app-overview ${styles.overview}`}>
        <div><span className="overview-icon tone-blue"><Smartphone size={18} /></span><strong>{data.metrics.applications}</strong><span><T id="apps.applications" /></span></div>
        <div><span className="overview-icon tone-mint"><Users size={18} /></span><strong>{data.metrics.campaigns_created}</strong><span><T id="apps.campaignsCreated" /></span></div>
        <div><strong>{data.metrics.testers_reached}</strong><span><T id="apps.testersReached" /></span></div>
        <div className={`heading-action ${styles.actions}`}><AppsFilterControl filter={filter} /><Link className="button button-primary" href="/apps/new"><Plus size={17} /><T id="apps.newApp" /></Link></div>
      </div>
      {apps.length === 0 ? <EmptyHint>
        <T id={data.apps.length === 0 ? "apps.empty" : "apps.emptyFiltered"} />{" "}
        <Link className="text-link" href={data.apps.length === 0 ? "/apps/new" : "/apps"}><T id={data.apps.length === 0 ? "apps.createApp" : "apps.backToAll"} /></Link>
      </EmptyHint> : <div className="app-grid">{apps.map((app) => {
        const initials = app.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
        return <article className={`panel app-card ${cardStyles.card}`} key={app.id}>
          <div className={cardStyles.header}>
            <div className={`app-mark ${cardStyles.icon} mark-${app.archived_at === null ? "mint" : "lavender"}`}>{initials}</div>
            <div className={cardStyles.copy}><h3 title={app.name}>{app.name}</h3><p>{app.description ?? ""}</p></div>
            <Badge status={app.archived_at === null ? "Activa" : "Archivada"} />
          </div>
          <AppArchivedAt value={app.archived_at} />
          <div className={`app-card-facts ${cardStyles.facts}`}>
            {app.platforms.length > 0 && <span><Smartphone size={15} /><T id={app.platforms.length === 2 ? "campaignForm.androidIos" : app.platforms[0] === "android" ? "explore.android" : "explore.ios"} /></span>}
            <span><Users size={15} /><T id="apps.campaignCount" values={{ count: app.round_count }} /></span>
          </div>
          <div className={`app-card-actions ${cardStyles.actions}`}><Link className="button button-secondary button-small" href={`/apps/${app.id}`}><T id="apps.editApp" /></Link><Link className={`button button-secondary button-small ${cardStyles.campaigns}`} href={`/apps/${app.id}/campaigns`}><T id="apps.viewCampaigns" /><ArrowRight size={14} /></Link></div>
        </article>;
      })}</div>}
    </>
  );
}
