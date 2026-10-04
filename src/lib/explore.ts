import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ExploreQuery = { platform: "android" | "ios" | null; limit: 12 | 24 | 48; page: number };
export type ExploreCampaign = {
  campaign_id: string;
  app_name: string;
  app_description: string | null;
  platform: "android" | "ios";
  status: "recruiting" | "testing";
  duration_days: number;
  target_testers: number;
  all_countries: boolean;
  country_codes: string[];
  covered_testers: number;
  available_slots: number;
};

export function parseExploreQuery(params: Record<string, string | string[] | undefined>): ExploreQuery {
  const platform = params.platform === "android" || params.platform === "ios" ? params.platform : null;
  const limit = params.limit === "24" ? 24 : params.limit === "48" ? 48 : 12;
  const page = typeof params.page === "string" && /^[1-9]\d*$/.test(params.page) ? Number(params.page) : 1;
  // The RPC uses a PostgreSQL integer offset.
  return { platform, limit, page: Number.isSafeInteger(page) && (page - 1) * limit <= 2147483647 ? page : 1 };
}

const fields = "campaign_id,app_name,app_description,platform,status,duration_days,target_testers,all_countries,country_codes,covered_testers,available_slots,total_count";
function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function isCampaign(value: unknown): value is ExploreCampaign {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.campaign_id === "string" && typeof row.app_name === "string" &&
    (row.app_description === null || typeof row.app_description === "string") &&
    (row.platform === "android" || row.platform === "ios") &&
    (row.status === "recruiting" || row.status === "testing") &&
    isCount(row.duration_days) && isCount(row.target_testers) && typeof row.all_countries === "boolean" &&
    Array.isArray(row.country_codes) && row.country_codes.every((code) => typeof code === "string") &&
    isCount(row.covered_testers) && isCount(row.available_slots);
}

export async function getExploreData(query: ExploreQuery): Promise<{ campaigns: ExploreCampaign[]; totalCount: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_available_campaigns", {
    p_platform: query.platform, p_limit: query.limit, p_offset: (query.page - 1) * query.limit,
  }).select(fields);
  if (error) throw new Error("Explore campaigns could not be loaded.");
  if (!Array.isArray(data) || data.length > query.limit || !data.every((row) => isCampaign(row) && isCount((row as ExploreCampaign & { total_count: unknown }).total_count))) {
    throw new Error("Explore RPC returned an invalid response.");
  }
  const totalCount = data[0]?.total_count ?? 0;
  if (data.some((row) => row.total_count !== totalCount) ||
      (data.length > 0 && totalCount < (query.page - 1) * query.limit + data.length)) {
    throw new Error("Explore RPC returned an invalid count.");
  }
  // Keep unexpected RPC fields out of the UI, even if the RPC changes.
  const campaigns = data.map((row) => ({
    campaign_id: row.campaign_id, app_name: row.app_name, app_description: row.app_description,
    platform: row.platform, status: row.status, duration_days: row.duration_days,
    target_testers: row.target_testers, all_countries: row.all_countries, country_codes: row.country_codes,
    covered_testers: row.covered_testers, available_slots: row.available_slots,
  }));
  return { campaigns, totalCount };
}

export type OwnParticipationStatus = "waiting_access" | "access_enabled" | "active" | "completed" | "incompatible" | "abandoned" | "cancelled";
export type ExploreCampaignDetail = ExploreCampaign & {
  min_os_major: number | null;
  min_os_minor: number | null;
  instructions: string | null;
  own_participation: { id: string; status: OwnParticipationStatus } | null;
};

export function isCampaignId(value: unknown): value is string {
  return typeof value === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
}

const detailFields = "campaign_id,app_name,app_description,platform,status,min_os_major,min_os_minor,duration_days,target_testers,all_countries,country_codes,instructions,covered_testers,available_slots,own_participation_id,own_participation_status";
const participationStatuses: readonly string[] = ["waiting_access", "access_enabled", "active", "completed", "incompatible", "abandoned", "cancelled"];

export async function getExploreCampaignDetail(
  campaignId: string,
  client?: Awaited<ReturnType<typeof createClient>>,
): Promise<ExploreCampaignDetail | null> {
  if (!isCampaignId(campaignId)) return null;
  const normalizedId = campaignId.toLowerCase();
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.rpc("get_campaign_detail", { p_campaign_id: normalizedId }).select(detailFields);
  if (error?.message === "CAMPAIGN_NOT_AVAILABLE") return null;
  if (error) throw new Error("Explore campaign detail could not be loaded.");
  if (!Array.isArray(data) || data.length !== 1 || !isCampaign(data[0])) {
    throw new Error("Explore detail RPC returned an invalid response.");
  }
  const row = data[0] as ExploreCampaign & Record<string, unknown>;
  if (row.campaign_id !== normalizedId ||
      !(row.instructions === null || typeof row.instructions === "string") ||
      !(row.min_os_major === null || isCount(row.min_os_major)) ||
      !(row.min_os_minor === null || isCount(row.min_os_minor)) ||
      (row.min_os_major === null && row.min_os_minor !== null) ||
      !((row.own_participation_id === null && row.own_participation_status === null) ||
        (typeof row.own_participation_id === "string" && typeof row.own_participation_status === "string" && participationStatuses.includes(row.own_participation_status)))) {
    throw new Error("Explore detail RPC returned an invalid response.");
  }
  return {
    campaign_id: row.campaign_id, app_name: row.app_name, app_description: row.app_description,
    platform: row.platform, status: row.status, duration_days: row.duration_days,
    target_testers: row.target_testers, all_countries: row.all_countries, country_codes: row.country_codes,
    covered_testers: row.covered_testers, available_slots: row.available_slots,
    min_os_major: row.min_os_major as number | null, min_os_minor: row.min_os_minor as number | null,
    instructions: row.instructions as string | null,
    own_participation: row.own_participation_id === null ? null : {
      id: row.own_participation_id as string, status: row.own_participation_status as OwnParticipationStatus,
    },
  };
}
