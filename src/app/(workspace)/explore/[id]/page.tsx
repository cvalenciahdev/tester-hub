import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock3, MapPin, ShieldCheck, Smartphone, Users } from "lucide-react";
import { campaigns } from "@/lib/mock-data";
import { Badge } from "@/components/ui";
import { T } from "@/lib/i18n";

export function generateStaticParams() {
  return campaigns.map(({ id }) => ({ id }));
}

export default async function CampaignDetailPage({ params }: PageProps<"/explore/[id]">) {
  const { id } = await params;
  const campaign = campaigns.find((item) => item.id === id);
  if (!campaign) notFound();
  const progress = Math.round((campaign.covered / campaign.target) * 100);

  return (
    <div className="detail-page">
      <Link className="back-link" href="/explore"><ArrowLeft size={16} /> <T id="detail.backToExplore" /></Link>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel detail-hero">
            <div className="detail-app-head"><div className={`app-mark app-mark-large mark-${campaign.color}`}>{campaign.icon}</div><div><div className="campaign-category">{campaign.category} <span>·</span> {campaign.app}</div><h1>{campaign.name}</h1></div><Badge status={campaign.status} /></div>
            <p className="detail-description">{campaign.description}</p>
            <div className="detail-facts">
              <div><span className="fact-icon"><Smartphone size={17} /></span><small><T id="common.platform" /></small><strong>{campaign.platform}</strong></div>
              <div><span className="fact-icon"><MapPin size={17} /></span><small><T id="common.countries" /></small><strong>{campaign.countries.join(", ")}</strong></div>
              <div><span className="fact-icon"><Clock3 size={17} /></span><small><T id="common.duration" /></small><strong>{campaign.duration}</strong></div>
              <div><span className="fact-icon"><ShieldCheck size={17} /></span><small><T id="common.minimumVersion" /></small><strong>{campaign.minVersion}</strong></div>
            </div>
          </section>
          <section className="panel detail-section"><div className="section-title"><span className="section-number">01</span><div><h2><T id="detail.aboutTitle" /></h2><p><T id="detail.aboutSubtitle" /></p></div></div><p>{campaign.description} <T id="detail.aboutBody" /></p><div className="detail-callout"><ShieldCheck size={18} /><span><T id="detail.betaNotice" /></span></div></section>
          <section className="panel detail-section"><div className="section-title"><span className="section-number">02</span><div><h2><T id="detail.instructions" /></h2><p><T id="detail.instructionsSubtitle" /></p></div></div><ol className="instructions-list">{campaign.instructions.map((instruction, index) => <li key={instruction}><span>{index + 1}</span>{instruction}</li>)}</ol></section>
        </div>
        <aside className="detail-aside">
          <section className="panel join-card"><div className="eyebrow"><T id="detail.availableSpots" /></div><div className="spots-line"><strong>{campaign.target - campaign.covered}</strong><span><T id="detail.spotsAvailable" values={{ target: campaign.target }} /></span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="join-meta"><span><Users size={15} />{campaign.covered} <T id="common.testers" /></span><span>{progress}%</span></div><Link className="button button-primary button-full" href="/my-tests"><T id="detail.joinTest" /> <ArrowRight size={16} /></Link><p className="join-footnote"><Check size={14} /> <T id="detail.freeWithdraw" /></p></section>
          <section className="panel info-card"><h3><T id="detail.requirements" /></h3><ul><li><Check size={15} /><T id="detail.compatibleDevice" /></li><li><Check size={15} />{campaign.minVersion}</li><li><Check size={15} /><T id="detail.storeEmail" /></li></ul><div className="info-divider" /><p><T id="detail.emailPrivacy" /></p></section>
        </aside>
      </div>
    </div>
  );
}
