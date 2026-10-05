import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readFeedbacks, type ParticipationFeedback } from "@/lib/participation-feedback";

export type ParticipationStatus = "waiting_access" | "access_enabled" | "active" | "completed" | "incompatible" | "abandoned" | "cancelled";
export type MyParticipation = {
  participation_id: string;
  campaign_id: string;
  app_name: string;
  platform: "android" | "ios";
  campaign_status: "draft" | "recruiting" | "testing" | "completed" | "cancelled";
  participation_status: ParticipationStatus;
  duration_days: number;
  store_url: string | null;
  installed_at: string | null;
  expected_end_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
  can_complete: boolean;
  feedbacks: ParticipationFeedback[];
};
export type MyTestsData = {
  metrics: { in_progress: number; waiting_access: number; completed: number };
  participations: MyParticipation[];
};
export type MyTestsFilter = "all" | "progress" | "waiting" | "completed";

export function parseMyTestsFilter(value: unknown): MyTestsFilter {
  return value === "progress" || value === "waiting" || value === "completed" ? value : "all";
}
export function filterMyParticipations(rows: MyParticipation[], filter: MyTestsFilter) {
  return rows.filter((row) => filter === "all" ||
    (filter === "progress" && (row.participation_status === "access_enabled" || row.participation_status === "active")) ||
    (filter === "waiting" && row.participation_status === "waiting_access") ||
    (filter === "completed" && row.participation_status === "completed"));
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function nullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
function nullableDate(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}
function installationUrl(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch { return null; }
}
function participation(value: unknown): value is MyParticipation {
  if (!record(value)) return false;
  return typeof value.participation_id === "string" && typeof value.campaign_id === "string" &&
    typeof value.app_name === "string" && (value.platform === "android" || value.platform === "ios") &&
    typeof value.campaign_status === "string" && ["draft", "recruiting", "testing", "completed", "cancelled"].includes(value.campaign_status) &&
    typeof value.participation_status === "string" && ["waiting_access", "access_enabled", "active", "completed", "incompatible", "abandoned", "cancelled"].includes(value.participation_status) &&
    count(value.duration_days) && value.duration_days > 0 && nullableText(value.store_url) &&
    ((value.participation_status === "access_enabled" || value.participation_status === "active") || value.store_url === null) && nullableDate(value.installed_at) &&
    nullableDate(value.expected_end_at) && nullableDate(value.closed_at) && nullableText(value.close_reason) &&
    readFeedbacks(value.feedbacks) !== null && typeof value.can_complete === "boolean" &&
    (!value.can_complete || (value.participation_status === "active" && value.expected_end_at !== null));
}
export async function getMyTestsData(): Promise<MyTestsData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_participations");
  if (error) throw new Error("My Tests could not be loaded.");
  if (!record(data) || !record(data.metrics) || !count(data.metrics.in_progress) ||
      !count(data.metrics.waiting_access) || !count(data.metrics.completed) ||
      !Array.isArray(data.participations) || !data.participations.every(participation)) {
    throw new Error("My Tests RPC returned an invalid response.");
  }
  const rows: MyParticipation[] = data.participations;
  if (new Set(rows.map((row) => row.participation_id)).size !== rows.length ||
      data.metrics.in_progress !== filterMyParticipations(rows, "progress").length ||
      data.metrics.waiting_access !== filterMyParticipations(rows, "waiting").length ||
      data.metrics.completed !== filterMyParticipations(rows, "completed").length) {
    throw new Error("My Tests RPC returned invalid metrics.");
  }
  return {
    metrics: { in_progress: data.metrics.in_progress, waiting_access: data.metrics.waiting_access, completed: data.metrics.completed },
    participations: rows.map((row) => ({
      participation_id: row.participation_id, campaign_id: row.campaign_id, app_name: row.app_name,
      platform: row.platform, campaign_status: row.campaign_status, participation_status: row.participation_status,
      duration_days: row.duration_days, store_url: installationUrl(row.store_url), installed_at: row.installed_at, expected_end_at: row.expected_end_at,
      closed_at: row.closed_at, close_reason: row.close_reason, can_complete: row.can_complete, feedbacks: readFeedbacks(row.feedbacks)!,
    })),
  };
}
