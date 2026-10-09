import { CountryAvailability } from "@/components/country-display";
import { ArrowUpRight, Clock3, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { T } from "@/lib/i18n";
import type { ExploreCampaign, ExploreQuery } from "@/lib/explore";

export function ExploreCampaignCard({ campaign, query }: { campaign: ExploreCampaign; query: ExploreQuery }) {
  const params = new URLSearchParams({ limit: String(query.limit), page: String(query.page) });
  if (query.platform) params.set("platform", query.platform);
  const platformKey = campaign.platform === "android" ? "explore.android" : "explore.ios";
  const initials = campaign.app_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const percentage = campaign.target_testers > 0 ? Math.min(100, Math.round(campaign.covered_testers / campaign.target_testers * 100)) : 0;
  return (
    <article className="campaign-card">
      <div className="campaign-card-top">
        <div className={`app-mark mark-${campaign.platform === "ios" ? "lavender" : "mint"}`}>{initials}</div>
        <span className={`badge ${campaign.status === "recruiting" ? "badge-blue" : "badge-violet"}`}>
          <T id={campaign.status === "recruiting" ? "status.Recruiting" : "explore.testing"} />
        </span>
      </div>
      <div className="campaign-category"><T id={platformKey} /></div>
      <h3>{campaign.app_name}</h3>
      <p className="campaign-card-description">{campaign.app_description ?? ""}</p>
      <div className="campaign-facts">
        <span><T id={platformKey} /></span>
        <span><MapPin size={14} />{<CountryAvailability all={campaign.all_countries} codes={campaign.country_codes} />}</span>
        <span><Clock3 size={14} /><T id="dashboard.durationDays" values={{ count: campaign.duration_days }} /></span>
      </div>
      <div className="campaign-progress-label">
        <span><Users size={14} /><T id="explore.coveredSpots" /></span>
        <span><T id="explore.spotsCount" values={{ covered: campaign.covered_testers, target: campaign.target_testers }} /></span>
      </div>
      <div className="progress-track"><span style={{ width: `${percentage}%` }} /></div>
      <Link className="text-link campaign-link" href={`/explore/${campaign.campaign_id}?${params.toString()}`}>
        <T id="explore.viewDetails" /> <ArrowUpRight size={15} />
      </Link>
    </article>
  );
}
