import "server-only";

import { createClient } from "@/lib/supabase/server";

export type DashboardData = {
  display_name: string | null;
  metrics: {
    active_campaigns: number;
    my_tests: number;
    waiting_for_access: number;
    active_testers: number;
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
  recent_activity: {
    event_type: string;
    created_at: string;
    campaign_id: string;
    app_name: string;
    is_own_participation: boolean;
  }[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
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
    isNullableString(value.display_name) &&
    isInteger(metrics.active_campaigns) &&
    isInteger(metrics.my_tests) &&
    isInteger(metrics.waiting_for_access) &&
    isInteger(metrics.active_testers) &&
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
    Array.isArray(activity) &&
    activity.length <= 3 &&
    activity.every(
      (event) =>
        isRecord(event) &&
        typeof event.event_type === "string" &&
        typeof event.created_at === "string" &&
        typeof event.campaign_id === "string" &&
        typeof event.app_name === "string" &&
        typeof event.is_own_participation === "boolean",
    ) &&
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
    throw error;
  }

  if (!isDashboardData(data)) {
    throw new Error("Dashboard RPC returned an invalid response.");
  }

  return data;
}
