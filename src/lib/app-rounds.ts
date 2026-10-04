import "server-only";

import { getCurrentUser } from "@/lib/auth";
import { isAppId } from "@/lib/apps";
import { createClient } from "@/lib/supabase/server";

export type RoundStatus = "draft" | "recruiting" | "testing" | "completed" | "cancelled";
export type RoundFilter = "all" | RoundStatus;
export type AppRound = {
  id: string;
  platform: "android" | "ios";
  status: RoundStatus;
  duration_days: number;
  target_testers: number;
  covered_testers: number;
  available_slots: number;
  participation_count: number;
};
const statuses: readonly string[] = ["draft", "recruiting", "testing", "completed", "cancelled"];
const participationStatuses: readonly string[] = ["waiting_access", "access_enabled", "active", "completed", "incompatible", "abandoned", "cancelled"];
const coveredStatuses = new Set(["waiting_access", "access_enabled", "active", "completed"]);
export function parseRoundFilter(value: unknown): RoundFilter {
  return typeof value === "string" && statuses.includes(value) ? value as RoundStatus : "all";
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
async function readAll(query: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query(offset, offset + 499);
    if (error || !Array.isArray(data)) throw new Error("App rounds could not be loaded.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function getAppRounds(appId: string): Promise<AppRound[]> {
  if (!isAppId(appId)) throw new Error("Invalid app identifier.");
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("App rounds authentication required.");
  const normalizedId = appId.toLowerCase();
  // Own app scope is explicit on both reads, in addition to the existing RLS.
  const [campaigns, participations] = await Promise.all([
    readAll((from, to) => supabase.from("test_campaigns")
      .select("id,app_id,platform,status,duration_days,target_testers,apps!inner(owner_id)")
      .eq("app_id", normalizedId).eq("apps.owner_id", user.id)
      .order("created_at", { ascending: false }).order("id").range(from, to)),
    readAll((from, to) => supabase.from("test_participations")
      .select("id,campaign_id,status,test_campaigns!inner(app_id,apps!inner(owner_id))")
      .eq("test_campaigns.app_id", normalizedId).eq("test_campaigns.apps.owner_id", user.id)
      .order("id").range(from, to)),
  ]);
  const counts = new Map<string, { total: number; covered: number }>();
  for (const row of participations) {
    if (!record(row) || !isAppId(row.id) || !isAppId(row.campaign_id) || typeof row.status !== "string" || !participationStatuses.includes(row.status)) {
      throw new Error("App participations returned an invalid response.");
    }
    const count = counts.get(row.campaign_id) ?? { total: 0, covered: 0 };
    count.total += 1;
    if (coveredStatuses.has(row.status)) count.covered += 1;
    counts.set(row.campaign_id, count);
  }
  return campaigns.map((row) => {
    if (!record(row) || !isAppId(row.id) || row.app_id !== normalizedId ||
        (row.platform !== "android" && row.platform !== "ios") || typeof row.status !== "string" || !statuses.includes(row.status) ||
        !positiveInteger(row.duration_days) || !positiveInteger(row.target_testers)) {
      throw new Error("App rounds returned an invalid response.");
    }
    const count = counts.get(row.id) ?? { total: 0, covered: 0 };
    return {
      id: row.id, platform: row.platform, status: row.status as RoundStatus,
      duration_days: row.duration_days, target_testers: row.target_testers,
      covered_testers: count.covered, available_slots: Math.max(0, row.target_testers - count.covered),
      participation_count: count.total,
    };
  });
}
