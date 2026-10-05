import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { isAppId } from "@/lib/apps";
import type { RoundStatus } from "@/lib/app-rounds";
import { createClient } from "@/lib/supabase/server";

export type OwnCampaign = {
  id: string; app_id: string; app_name: string; app_description: string | null; archived: boolean;
  platform: "android" | "ios"; status: RoundStatus; target_testers: number; duration_days: number;
  all_countries: boolean; country_codes: string[]; min_os_major: number | null; min_os_minor: number | null;
  store_url: string | null; instructions: string | null;
  has_participations: boolean; covered_testers: number;
};
export async function getOwnCampaign(id: string): Promise<OwnCampaign | null> {
  if (!isAppId(id)) return null;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("Campaign authentication required.");
  const { data, error } = await supabase.from("test_campaigns")
    .select("id,app_id,platform,status,target_testers,duration_days,all_countries,min_os_major,min_os_minor,store_url,instructions,apps!inner(owner_id,name,description,archived_at)")
    .eq("id", id).eq("apps.owner_id", user.id).maybeSingle();
  if (error) throw new Error("Campaign could not be loaded.");
  if (!data) return null;
  const app = data.apps as unknown as { owner_id: string; name: string; description: string | null; archived_at: string | null };
  if (!app || app.owner_id !== user.id || !["draft", "recruiting", "testing", "completed", "cancelled"].includes(data.status) ||
      !["android", "ios"].includes(data.platform)) throw new Error("Invalid campaign response.");
  const [countries, history, coverage] = await Promise.all([
    supabase.from("campaign_countries").select("country_code").eq("campaign_id", data.id).order("country_code"),
    supabase.from("test_participations").select("id", { count: "exact", head: true }).eq("campaign_id", data.id),
    supabase.from("test_participations").select("id", { count: "exact", head: true }).eq("campaign_id", data.id).in("status", ["waiting_access", "access_enabled", "active", "completed"]),
  ]);
  if (countries.error || !countries.data || history.error || history.count === null || coverage.error || coverage.count === null) {
    throw new Error("Campaign requirements could not be loaded.");
  }
  return {
    id: data.id, app_id: data.app_id, app_name: app.name, app_description: app.description, archived: app.archived_at !== null,
    platform: data.platform, status: data.status as RoundStatus, target_testers: data.target_testers, duration_days: data.duration_days,
    all_countries: data.all_countries, country_codes: countries.data.map((row) => row.country_code),
    min_os_major: data.min_os_major, min_os_minor: data.min_os_minor,
    store_url: data.store_url, instructions: data.instructions,
    has_participations: history.count > 0, covered_testers: coverage.count,
  };
}
