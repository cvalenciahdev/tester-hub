import Link from "next/link";
import { ArrowRight, Plus, Smartphone, Users } from "lucide-react";
import { Badge, EmptyHint, PageHeading } from "@/components/ui";
import { T } from "@/lib/i18n";
import { getAppsData, parseAppsFilter } from "@/lib/apps";
import { AppArchivedAt, AppsFilterControl } from "./apps-controls";

export default async function AppsPage({ searchParams }: PageProps<"/apps">) {
  const filter = parseAppsFilter((await searchParams).status);
  const data = await getAppsData();
  const apps = data.apps.filter((app) => filter === "all" || (filter === "active" ? app.archived_at === null : app.archived_at !== null));
  return (
    <>
      <PageHeading eyebrow={<T id="apps.eyebrow" />} title={<T id="apps.title" />} description={<T id="apps.description" />} action={<Link className="button button-primary" href="/apps/new"><Plus size={17} /><T id="apps.newApp" /></Link>} />
      <div className="app-overview">
        <div><span className="overview-icon tone-blue"><Smartphone size={18} /></span><strong>{data.metrics.applications}</strong><span><T id="apps.applications" /></span></div>
        <div><span className="overview-icon tone-mint"><Users size={18} /></span><strong>{data.metrics.campaigns_created}</strong><span><T id="apps.campaignsCreated" /></span></div>
        <div><strong>{data.metrics.testers_reached}</strong><span><T id="apps.testersReached" /></span></div>
      </div>
      <div className="section-row"><div><h2><T id="apps.yourApps" /></h2><p><T id="apps.yourAppsDescription" /></p></div><AppsFilterControl filter={filter} /></div>
      {apps.length === 0 ? <EmptyHint>
        <T id={data.apps.length === 0 ? "apps.empty" : "apps.emptyFiltered"} />{" "}
        <Link className="text-link" href={data.apps.length === 0 ? "/apps/new" : "/apps"}><T id={data.apps.length === 0 ? "apps.createApp" : "apps.backToAll"} /></Link>
      </EmptyHint> : <div className="app-grid">{apps.map((app) => {
        const initials = app.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
        return <article className="panel app-card" key={app.id}>
          <div className="app-card-top"><div className={`app-mark app-mark-large mark-${app.archived_at === null ? "mint" : "lavender"}`}>{initials}</div></div>
          <div className="app-card-title"><h3>{app.name}</h3><Badge status={app.archived_at === null ? "Activa" : "Archivada"} /></div>
          <p>{app.description ?? ""}</p>
          <small className="muted-cell" style={{ overflowWrap: "anywhere" }}><T id="apps.id" />: {app.id}</small>{" "}<AppArchivedAt value={app.archived_at} />
          <div className="app-card-facts">
            {app.platforms.length > 0 && <span><Smartphone size={15} /><T id={app.platforms.length === 2 ? "campaignForm.androidIos" : app.platforms[0] === "android" ? "explore.android" : "explore.ios"} /></span>}
            <span><Users size={15} /><T id="apps.campaignCount" values={{ count: app.round_count }} /></span>
          </div>
          <div className="app-card-actions"><Link className="button button-secondary button-small" href={`/apps/${app.id}`}><T id="apps.viewApp" /><ArrowRight size={14} /></Link></div>
        </article>;
      })}</div>}
      <div className="app-tip"><span><strong><T id="apps.notListed" /></strong> <T id="apps.createAppPrompt" /></span><Link className="text-link" href="/apps/new"><T id="apps.createApp" /><ArrowRight size={14} /></Link></div>
    </>
  );
}
