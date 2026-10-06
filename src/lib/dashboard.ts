import "server-only";

import { createClient } from "@/lib/supabase/server";

export type DashboardData = {
  initial_intent: "tester" | "developer" | "both" | null;
  metrics: {
    active_campaigns: number;
    tester_active_tests: number;
    waiting_for_access: number;
    feedback_pending: number;
    ready_to_complete: number;
    owner_waiting_access: number;
    owner_testers_in_progress: number;
    completed_campaigns: number;
  };
  tests: {
    participation_id: string;
    campaign_id: string;
    app_id: string;
    app_name: string;
    status: "waiting_access" | "access_enabled" | "active";
    installed_at: string | null;
    expected_end_at: string | null;
    duration_days: number;
    progress_percent: number | null;
  }[];
  recent_activity: { tester: DashboardActivity[]; developer: DashboardActivity[] };
  campaigns_for_you: {
    campaign_id: string;
    app_id: string;
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
  }[];
};
export type DashboardActivity = {
  event_type: string;
  created_at: string;
  campaign_id: string;
  app_name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isActivity(value: unknown): value is DashboardActivity[] {
  return Array.isArray(value) && value.length <= 3 && value.every((event) =>
    isRecord(event) &&
    typeof event.event_type === "string" &&
    typeof event.created_at === "string" &&
    typeof event.campaign_id === "string" &&
    typeof event.app_name === "string",
  );
}

function isDashboardData(value: unknown): value is DashboardData {
  if (!isRecord(value) || !isRecord(value.metrics)) {
    return false;
  }

  const metrics = value.metrics;
  const tests = value.tests;
  const activity = value.recent_activity;
  const campaigns = value.campaigns_for_you;

  return (
    (value.initial_intent === null || value.initial_intent === "tester" || value.initial_intent === "developer" || value.initial_intent === "both") &&
    isInteger(metrics.active_campaigns) &&
    isInteger(metrics.tester_active_tests) &&
    isInteger(metrics.waiting_for_access) &&
    isInteger(metrics.feedback_pending) &&
    isInteger(metrics.ready_to_complete) &&
    isInteger(metrics.owner_waiting_access) &&
    isInteger(metrics.owner_testers_in_progress) &&
    isInteger(metrics.completed_campaigns) &&
    Array.isArray(tests) &&
    tests.length <= 3 &&
    tests.every(
      (test) =>
        isRecord(test) &&
        typeof test.participation_id === "string" &&
        typeof test.campaign_id === "string" &&
        typeof test.app_id === "string" &&
        typeof test.app_name === "string" &&
        (test.status === "waiting_access" ||
          test.status === "access_enabled" ||
          test.status === "active") &&
        isNullableString(test.installed_at) &&
        isNullableString(test.expected_end_at) &&
        isInteger(test.duration_days) &&
        (test.progress_percent === null ||
          (isInteger(test.progress_percent) &&
            test.progress_percent >= 0 &&
            test.progress_percent <= 100)),
    ) &&
    isRecord(activity) && isActivity(activity.tester) && isActivity(activity.developer) &&
    Array.isArray(campaigns) &&
    campaigns.length <= 3 &&
    campaigns.every(
      (campaign) =>
        isRecord(campaign) &&
        typeof campaign.campaign_id === "string" &&
        typeof campaign.app_id === "string" &&
        typeof campaign.app_name === "string" &&
        isNullableString(campaign.app_description) &&
        (campaign.platform === "android" || campaign.platform === "ios") &&
        (campaign.status === "recruiting" || campaign.status === "testing") &&
        isInteger(campaign.duration_days) &&
        isInteger(campaign.target_testers) &&
        typeof campaign.all_countries === "boolean" &&
        Array.isArray(campaign.country_codes) &&
        campaign.country_codes.every(
          (countryCode) => typeof countryCode === "string",
        ) &&
        isInteger(campaign.covered_testers) &&
        isInteger(campaign.available_slots),
    )
  );
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dashboard_data");

  if (error) {
    throw new Error("Dashboard could not be loaded.");
  }

  if (!isDashboardData(data)) {
    throw new Error("Dashboard RPC returned an invalid response.");
  }

  const activity = (rows: DashboardActivity[]) => rows.map((row) => ({
    event_type: row.event_type,
    created_at: row.created_at,
    campaign_id: row.campaign_id,
    app_name: row.app_name,
  }));
  return {
    initial_intent: data.initial_intent,
    metrics: {
      active_campaigns: data.metrics.active_campaigns,
      tester_active_tests: data.metrics.tester_active_tests,
      waiting_for_access: data.metrics.waiting_for_access,
      feedback_pending: data.metrics.feedback_pending,
      ready_to_complete: data.metrics.ready_to_complete,
      owner_waiting_access: data.metrics.owner_waiting_access,
      owner_testers_in_progress: data.metrics.owner_testers_in_progress,
      completed_campaigns: data.metrics.completed_campaigns,
    },
    tests: data.tests.map((row) => ({
      participation_id: row.participation_id,
      campaign_id: row.campaign_id,
      app_id: row.app_id,
      app_name: row.app_name,
      status: row.status,
      installed_at: row.installed_at,
      expected_end_at: row.expected_end_at,
      duration_days: row.duration_days,
      progress_percent: row.progress_percent,
    })),
    recent_activity: {
      tester: activity(data.recent_activity.tester),
      developer: activity(data.recent_activity.developer),
    },
    campaigns_for_you: data.campaigns_for_you.map((row) => ({
      campaign_id: row.campaign_id,
      app_id: row.app_id,
      app_name: row.app_name,
      app_description: row.app_description,
      platform: row.platform,
      status: row.status,
      duration_days: row.duration_days,
      target_testers: row.target_testers,
      all_countries: row.all_countries,
      country_codes: [...row.country_codes],
      covered_testers: row.covered_testers,
      available_slots: row.available_slots,
    })),
  };
}
