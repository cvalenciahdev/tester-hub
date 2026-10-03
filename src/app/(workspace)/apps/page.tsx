import Link from "next/link";
import { ArrowRight, Ellipsis, Plus, Smartphone, Users } from "lucide-react";
import { myApps } from "@/lib/mock-data";
import { Badge, PageHeading } from "@/components/ui";
import { T, TranslatedIconButton } from "@/lib/i18n";

export default function AppsPage() {
  return (
    <>
      <PageHeading eyebrow={<T id="apps.eyebrow" />} title={<T id="apps.title" />} description={<T id="apps.description" />} />
      <div className="app-overview"><div><span className="overview-icon tone-blue"><Smartphone size={18} /></span><strong>3</strong><span><T id="apps.applications" /></span></div><div><span className="overview-icon tone-mint"><Users size={18} /></span><strong>4</strong><span><T id="apps.campaignsCreated" /></span></div><div><strong>56</strong><span><T id="apps.testersReached" /></span></div></div>
      <div className="section-row"><div><h2><T id="apps.yourApps" /></h2><p><T id="apps.yourAppsDescription" /></p></div><label className="sr-only" htmlFor="apps-filter"><T id="apps.filter" /></label><select id="apps-filter" defaultValue="all"><option value="all"><T id="apps.all" /></option><option value="active"><T id="apps.active" /></option><option value="archived"><T id="apps.archived" /></option></select></div>
      <div className="app-grid">{myApps.map((app) => <article className="panel app-card" key={app.name}>
        <div className="app-card-top"><div className={`app-mark app-mark-large mark-${app.color}`}>{app.icon}</div><TranslatedIconButton label="apps.optionsFor" values={{ name: app.name }} className="dots-button"><Ellipsis size={19} /></TranslatedIconButton></div>
        <div className="app-card-title"><h3>{app.name}</h3><Badge status={app.status as "Activa" | "Archivada"} /></div>
        <p>{app.description}</p><div className="app-card-facts"><span><Smartphone size={15} />{app.platform}</span><span><Users size={15} /><T id="apps.campaignCount" values={{ count: app.campaigns }} /></span></div>
        <div className="app-card-actions"><Link className="button button-secondary button-small" href="/campaigns"><T id="apps.viewCampaigns" /> <ArrowRight size={14} /></Link><Link className="button button-quiet button-small" href="/campaigns/new"><T id="apps.newCampaign" /> <Plus size={14} /></Link></div>
      </article>)}</div>
      <div className="app-tip"><span><strong><T id="apps.notListed" /></strong> <T id="apps.createCampaignPrompt" /></span><Link className="text-link" href="/campaigns/new"><T id="apps.createCampaign" /> <ArrowRight size={14} /></Link></div>
    </>
  );
}
