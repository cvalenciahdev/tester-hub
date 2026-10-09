import { CountryAvailability } from "@/components/country-display";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock3, MapPin, ShieldCheck, Smartphone, Users } from "lucide-react";
import { T } from "@/lib/i18n";
import { getExploreCampaignDetail, parseExploreQuery } from "@/lib/explore";
import { JoinCampaignButton } from "./join-campaign-button";

export default async function CampaignDetailPage({ params, searchParams }: PageProps<"/explore/[id]">) {
  const { id } = await params;
  const campaign = await getExploreCampaignDetail(id);
  if (!campaign) notFound();
  const query = parseExploreQuery(await searchParams);
  const returnParams = new URLSearchParams({ limit: String(query.limit), page: String(query.page) });
  if (query.platform) returnParams.set("platform", query.platform);
  const progress = campaign.target_testers > 0 ? Math.min(100, Math.round(campaign.covered_testers / campaign.target_testers * 100)) : 0;
  const platformKey = campaign.platform === "android" ? "explore.android" : "explore.ios";
  const initials = campaign.app_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const minVersion = campaign.min_os_major === null ? null : `${campaign.platform === "android" ? "Android" : "iOS"} ${campaign.min_os_major}${campaign.min_os_minor === null ? "" : `.${campaign.min_os_minor}`}+`;

  return (
    <div className="detail-page">
      <Link className="back-link" href={`/explore?${returnParams.toString()}`}><ArrowLeft size={16} /> <T id="detail.backToExplore" /></Link>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel detail-hero">
            <div className="detail-app-head">
              <div className={`app-mark app-mark-large mark-${campaign.platform === "ios" ? "lavender" : "mint"}`}>{initials}</div>
              <div><div className="campaign-category"><T id={platformKey} /></div><h1>{campaign.app_name}</h1></div>
              <span className={`badge ${campaign.status === "recruiting" ? "badge-blue" : "badge-violet"}`}><T id={campaign.status === "recruiting" ? "status.Recruiting" : "explore.testing"} /></span>
            </div>
            <p className="detail-description">{campaign.app_description ?? ""}</p>
            <div className="detail-facts">
              <div><span className="fact-icon"><Smartphone size={17} /></span><small><T id="common.platform" /></small><strong><T id={platformKey} /></strong></div>
              <div><span className="fact-icon"><MapPin size={17} /></span><small><T id="common.countries" /></small><strong>{<CountryAvailability all={campaign.all_countries} codes={campaign.country_codes} />}</strong></div>
              <div><span className="fact-icon"><Clock3 size={17} /></span><small><T id="common.duration" /></small><strong><T id="dashboard.durationDays" values={{ count: campaign.duration_days }} /></strong></div>
              {minVersion && <div><span className="fact-icon"><ShieldCheck size={17} /></span><small><T id="common.minimumVersion" /></small><strong>{minVersion}</strong></div>}
            </div>
          </section>
          <section className="panel detail-section">
            <div className="section-title"><span className="section-number">01</span><div><h2><T id="detail.aboutTitle" /></h2><p><T id="detail.aboutSubtitle" /></p></div></div>
            <p>{campaign.app_description ?? ""}</p>
            <div className="detail-callout"><ShieldCheck size={18} /><span><T id="detail.betaNotice" /></span></div>
          </section>
          <section className="panel detail-section">
            <div className="section-title"><span className="section-number">02</span><div><h2><T id="detail.instructions" /></h2><p><T id="detail.instructionsSubtitle" /></p></div></div>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{campaign.instructions ?? ""}</p>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel join-card">
            <div className="eyebrow"><T id="detail.availableSpots" /></div>
            <div className="spots-line"><strong>{campaign.available_slots}</strong><span><T id="detail.spotsAvailable" values={{ target: campaign.target_testers }} /></span></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="join-meta"><span><Users size={15} />{campaign.covered_testers} <T id="common.testers" /></span><span>{progress}%</span></div>
            <JoinCampaignButton campaignId={campaign.campaign_id} availableSlots={campaign.available_slots} participation={campaign.own_participation} />
            <p className="join-footnote"><Check size={14} /> <T id="detail.freeWithdraw" /></p>
          </section>
          <section className="panel info-card">
            <h3><T id="detail.requirements" /></h3>
            <ul><li><Check size={15} /><T id="detail.compatibleDevice" /></li>{minVersion && <li><Check size={15} />{minVersion}</li>}<li><Check size={15} /><T id="detail.storeEmail" /></li></ul>
            <div className="info-divider" /><p><T id="detail.emailPrivacy" /></p>
          </section>
        </aside>
      </div>
    </div>
  );
}
