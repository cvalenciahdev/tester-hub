import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { myCampaigns } from "@/lib/mock-data";
import { Badge } from "@/components/ui";
import { T } from "@/lib/i18n";

export default function CampaignsPage() {
  return (
    <>
      <h1 className="sr-only"><T id="campaigns.title" /></h1>
      <div className="test-summary-strip campaign-summary"><div><span className="summary-dot dot-blue" /><strong>2</strong><span><T id="campaigns.active" /></span></div><div><span className="summary-dot dot-amber" /><strong>1</strong><span><T id="campaigns.recruiting" /></span></div><div><span className="summary-dot dot-green" /><strong>1</strong><span><T id="campaigns.completed" /></span></div></div>
      <section className="panel table-panel">
        <div className="table-toolbar" style={{ flexWrap: "wrap" }}><div><h2><T id="campaigns.all" /></h2><p><T id="campaigns.overview" /></p></div><div className="heading-action" style={{ gap: 10, flexWrap: "wrap" }}><label className="sr-only" htmlFor="campaign-status-filter"><T id="campaigns.filter" /></label><select id="campaign-status-filter" defaultValue="all"><option value="all"><T id="campaigns.allStatuses" /></option><option value="recruiting"><T id="status.Recruiting" /></option><option value="testing"><T id="status.Testing" /></option><option value="completed"><T id="status.Completed" /></option><option value="draft"><T id="status.Draft" /></option></select><Link className="button button-primary" href="/campaigns/new"><Plus size={17} /> <T id="campaigns.new" /></Link></div></div>
        <div className="table-scroll"><table><thead><tr><th><T id="campaigns.name" /></th><th><T id="campaigns.status" /></th><th><T id="campaigns.platform" /></th><th><T id="campaigns.testers" /></th><th><T id="campaigns.progress" /></th><th /></tr></thead><tbody>
          {myCampaigns.map((campaign) => {
            const percent = Math.round((campaign.covered / campaign.target) * 100);
            return <tr key={campaign.name}><td><div className="campaign-table-name"><strong>{campaign.name}</strong><small>{campaign.app}</small></div></td><td><Badge status={campaign.status} /></td><td className="muted-cell">{campaign.platform}</td><td className="muted-cell">{campaign.covered} / {campaign.target}</td><td><div className="table-progress"><span><i style={{ width: `${percent}%` }} /></span><small>{percent}%</small></div></td><td><div className="table-actions"><Link className="row-action row-action-strong" href={`/campaigns/${campaign.id}/tracking`}><T id="campaigns.viewTracking" /> <ArrowRight size={14} /></Link><Link className="row-edit" href="/campaigns/new"><T id="campaigns.edit" /></Link></div></td></tr>;
          })}
        </tbody></table></div>
      </section>
      <div className="demo-note"><T id="campaigns.demoData" /></div>
    </>
  );
}
