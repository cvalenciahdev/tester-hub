"use client";

import { countryName } from "@/lib/countries";
import { CampaignCard } from "@/components/ui";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { Campaign, CampaignStatus } from "@/lib/campaign-card-types";
import type { DashboardData } from "@/lib/dashboard";

const campaignStatuses: Record<
  DashboardData["campaigns_for_you"][number]["status"],
  CampaignStatus
> = {
  recruiting: "Recruiting",
  testing: "Testing",
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

export function DashboardCampaignCard({
  campaign,
}: {
  campaign: DashboardData["campaigns_for_you"][number];
}) {
  const { t, language } = useI18n();
  const platformKey: TranslationKey =
    campaign.platform === "android" ? "explore.android" : "explore.ios";
  const platform = t(platformKey);
  const card: Campaign = {
    id: campaign.campaign_id,
    name: campaign.app_name,
    app: campaign.app_name,
    category: platform,
    description: campaign.app_description ?? "",
    platform,
    countries: campaign.all_countries
      ? [t("dashboard.allCountries")]
      : campaign.country_codes.length > 3 ? [t("countries.count", { count: campaign.country_codes.length })] : campaign.country_codes.map((code) => countryName(code, language)),
    minVersion: "",
    duration: t("dashboard.durationDays", { count: campaign.duration_days }),
    target: campaign.target_testers,
    covered: campaign.covered_testers,
    status: campaignStatuses[campaign.status],
    color: campaign.platform === "ios" ? "lavender" : "mint",
    icon: getInitials(campaign.app_name),
    instructions: [],
  };

  return <CampaignCard campaign={card} />;
}
