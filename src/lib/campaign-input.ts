import { isCountryCode } from "@/lib/countries";
import { parseDuration } from "@/lib/campaign-duration";

export type CampaignError = "auth" | "unavailable" | "archived" | "state" | "locked" | "target" | "duration" | "durationRange" | "iosDuration" | "os" | "countries" | "platform" | "failed";
export type CampaignResult = { error?: CampaignError; saved?: boolean; createdCampaign?: { id: string; confirmedDraft: boolean } };
export function campaignError(error: { message?: string; code?: string }): CampaignError {
  const known: Record<string, CampaignError> = {
    NOT_AUTHENTICATED: "auth", APP_NOT_FOUND: "unavailable", CAMPAIGN_NOT_FOUND: "unavailable",
    NOT_APP_OWNER: "unavailable", NOT_CAMPAIGN_OWNER: "unavailable", APP_ARCHIVED: "archived",
    INVALID_CAMPAIGN_STATE: "state", STRUCTURAL_FIELDS_LOCKED: "locked", TARGET_BELOW_COVERED_TESTERS: "target",
    INVALID_TARGET_TESTERS: "target", INVALID_DURATION_DAYS: "duration", INVALID_OS_VERSION: "os",
    IOS_DURATION_EXCEEDED: "iosDuration",
    DURATION_OUT_OF_RANGE: "durationRange",
    INVALID_COUNTRY_CODE: "countries", CAMPAIGN_COUNTRIES_REQUIRED: "countries",
  };
  return known[error.message ?? ""] ?? "failed";
}
function integer(value: FormDataEntryValue | null, minimum: number, maximum: number, nullable = false): number | null | undefined {
  if (nullable && value === "") return null;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}
export function campaignInput(form: FormData, structural: boolean) {
  const target = integer(form.get("target_testers"), 1, 2147483647);
  if (target === undefined) return { error: "target" as const };
  const fields = {
    p_target_testers: target as number,
    p_store_url: typeof form.get("store_url") === "string" ? (form.get("store_url") as string).trim() : null,
    p_instructions: typeof form.get("instructions") === "string" ? (form.get("instructions") as string).trim() : null,
  };
  if (!structural) return { fields };
  const platform = form.get("platform");
  if (platform !== "android" && platform !== "ios") return { error: "platform" as const };
  const duration = parseDuration(form.get("duration_days"));
  if (duration === null) return { error: "duration" as const };
  if (platform === "ios" && duration > 90) return { error: "iosDuration" as const };
  const all = form.get("all_countries") === "on";
  const raw = form.getAll("country_codes");
  if (!all && raw.some((value) => typeof value !== "string")) return { error: "countries" as const };
  const countries = all ? [] : [...new Set((raw as string[]).flatMap((value) => value.split(/[\s,;]+/).filter(Boolean).map((code) => code.toUpperCase())))];
  if ((!all && countries.length === 0) || countries.some((code) => !isCountryCode(code))) return { error: "countries" as const };
  return { fields: { ...fields, p_platform: platform, p_duration_days: duration as number, p_all_countries: all,
    p_country_codes: countries } };
}
