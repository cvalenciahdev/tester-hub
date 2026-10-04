import { redirect } from "next/navigation";
import { EmptyHint, PageHeading } from "@/components/ui";
import { T } from "@/lib/i18n";
import { getExploreData, parseExploreQuery } from "@/lib/explore";
import { ExploreControls } from "./explore-controls";
import { ExploreCampaignCard } from "./explore-campaign-card";

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const query = parseExploreQuery(await searchParams);
  const { campaigns, totalCount } = await getExploreData(query);
  if (query.page > 1 && campaigns.length === 0) {
    const params = new URLSearchParams({ limit: String(query.limit), page: "1" });
    if (query.platform) params.set("platform", query.platform);
    redirect(`/explore?${params.toString()}`);
  }
  // Distinguish a platform with no matches from no discovery results at all.
  const hasOtherCampaigns = campaigns.length === 0 && query.platform !== null
    ? (await getExploreData({ platform: null, limit: 12, page: 1 })).totalCount > 0
    : false;
  return (
    <>
      <PageHeading eyebrow={<T id="explore.eyebrow" />} title={<T id="explore.title" />} description={<T id="explore.description" />} />
      <ExploreControls query={query} />
      <div className="campaign-results-heading"><h2>{totalCount} <T id="explore.available" /></h2></div>
      {campaigns.length === 0 ? (
        <EmptyHint><T id={hasOtherCampaigns ? "explore.emptyFiltered" : "explore.empty"} /></EmptyHint>
      ) : (
        <div className="campaign-grid">{campaigns.map((campaign) => <ExploreCampaignCard campaign={campaign} query={query} key={campaign.campaign_id} />)}</div>
      )}
      <ExploreControls query={query} totalCount={totalCount} />
    </>
  );
}
