import "server-only";
import { isAppId } from "@/lib/apps";
import type { RoundStatus } from "@/lib/app-rounds";
import type { ParticipationStatus } from "@/lib/my-tests";
import { createClient } from "@/lib/supabase/server";
import { readFeedbacks, type ParticipationFeedback } from "@/lib/participation-feedback";

export const trackingStatuses = ["waiting_access", "access_enabled", "active", "completed", "incompatible", "abandoned", "cancelled"] as const;
export type TrackedParticipation = {
  participation_id: string; tester_id: string; display_name: string | null; country_code: string | null;
  testing_email_snapshot: string; participation_status: ParticipationStatus; joined_at: string;
  access_enabled_at: string | null; installed_at: string | null; expected_end_at: string | null;
  closed_at: string | null; close_reason: string | null;
  feedbacks: ParticipationFeedback[];
};
export type TrackingCampaign = {
  campaign_id: string; app_id: string; app_name: string; platform: "android" | "ios"; campaign_status: RoundStatus;
  target_testers: number; duration_days: number; covered_testers: number; available_slots: number; total_participations: number;
} & Record<`${ParticipationStatus}_count`, number>;
export type CampaignTracking = { campaign: TrackingCampaign; participations: TrackedParticipation[] };
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function count(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function text(value: unknown): value is string | null { return value === null || typeof value === "string"; }
function date(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function nullableDate(value: unknown): value is string | null { return value === null || date(value); }
function participation(value: unknown): value is TrackedParticipation {
  return record(value) && isAppId(value.participation_id) && isAppId(value.tester_id) && text(value.display_name) &&
    (value.country_code === null || (typeof value.country_code === "string" && /^[A-Z]{2}$/.test(value.country_code))) &&
    typeof value.testing_email_snapshot === "string" && typeof value.participation_status === "string" && trackingStatuses.some((s) => s === value.participation_status) &&
    date(value.joined_at) && nullableDate(value.access_enabled_at) && nullableDate(value.installed_at) &&
    nullableDate(value.expected_end_at) && nullableDate(value.closed_at) && text(value.close_reason) && readFeedbacks(value.feedbacks) !== null;
}
export async function getCampaignTracking(id: string): Promise<CampaignTracking | null> {
  if (!isAppId(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_campaign_tracking", { p_campaign_id: id });
  if (error?.message === "CAMPAIGN_NOT_AVAILABLE") return null;
  if (error) throw new Error("Tracking could not be loaded.");
  if (!record(data) || !record(data.campaign) || !Array.isArray(data.participations) || !data.participations.every(participation)) throw new Error("Invalid tracking response.");
  const rows: TrackedParticipation[] = data.participations;
  const c = data.campaign;
  if (c.campaign_id !== id.toLowerCase() || !isAppId(c.app_id) || typeof c.app_name !== "string" ||
      (c.platform !== "android" && c.platform !== "ios") || typeof c.campaign_status !== "string" ||
      !["draft", "recruiting", "testing", "completed", "cancelled"].includes(c.campaign_status) ||
      !count(c.target_testers) || c.target_testers < 1 || !count(c.duration_days) || c.duration_days < 1 ||
      !count(c.covered_testers) || !count(c.available_slots) || c.total_participations !== rows.length ||
      new Set(rows.map((p) => p.participation_id)).size !== rows.length) throw new Error("Invalid tracking campaign.");
  const counts = Object.fromEntries(trackingStatuses.map((status) => {
    const value = c[`${status}_count`];
    if (!count(value) || value !== rows.filter((p) => p.participation_status === status).length) throw new Error("Invalid tracking counts.");
    return [`${status}_count`, value];
  })) as Record<`${ParticipationStatus}_count`, number>;
  if (c.covered_testers !== counts.waiting_access_count + counts.access_enabled_count + counts.active_count + counts.completed_count ||
      c.available_slots !== Math.max(c.target_testers - c.covered_testers, 0)) throw new Error("Invalid tracking coverage.");
  return {
    campaign: { campaign_id: c.campaign_id as string, app_id: c.app_id, app_name: c.app_name, platform: c.platform,
      campaign_status: c.campaign_status as RoundStatus, target_testers: c.target_testers, duration_days: c.duration_days,
      covered_testers: c.covered_testers, available_slots: c.available_slots, total_participations: rows.length, ...counts },
    participations: rows.map((p) => ({ participation_id: p.participation_id, tester_id: p.tester_id,
      display_name: p.display_name, country_code: p.country_code, testing_email_snapshot: p.testing_email_snapshot,
      participation_status: p.participation_status, joined_at: p.joined_at, access_enabled_at: p.access_enabled_at,
      installed_at: p.installed_at, expected_end_at: p.expected_end_at, closed_at: p.closed_at, close_reason: p.close_reason, feedbacks: readFeedbacks(p.feedbacks)! })),
  };
}
