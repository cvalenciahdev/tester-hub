import { UNKNOWN_OS_MAJOR_VERSION, knownOsMajorVersion } from "@/lib/device-os";
import { isCountryCode } from "@/lib/countries";

export type ProfileDevice = { id?: string; platform: "android" | "ios"; os_major: number; os_minor: number | null; model: string | null };
export type ProfileInput = { display_name: string | null; country_code: string; testing_email: string; initial_intent: "tester" | "developer" | "both"; devices: ProfileDevice[] };
export type ProfileError = "country" | "email" | "intent" | "devices" | "device" | "ownership" | "auth" | "missing" | "failed";
export type ProfileResult = { error?: ProfileError; saved?: boolean };
export function isDeviceId(value: unknown): value is string { return typeof value === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value); }
export function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function version(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 32767; }
export function parseProfileInput(form: FormData): { input?: ProfileInput; error?: ProfileError } {
  const string = (key: string) => typeof form.get(key) === "string" ? (form.get(key) as string).trim() : "";
  const country = string("country_code").toUpperCase(), email = string("testing_email"), intent = string("initial_intent");
  if (!isCountryCode(country)) return { error: "country" };
  if (!validEmail(email)) return { error: "email" };
  if (intent !== "tester" && intent !== "developer" && intent !== "both") return { error: "intent" };
  let rows: unknown;
  try { rows = JSON.parse(string("devices")); } catch { return { error: "devices" }; }
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 2) return { error: "devices" };
  const devices: ProfileDevice[] = [], platforms = new Set(), ids = new Set();
  for (const row of rows) {
    if (!row || typeof row !== "object") return { error: "device" };
    const major = row.os_major === null || row.os_major === undefined || row.os_major === "" ? UNKNOWN_OS_MAJOR_VERSION : row.os_major;
    if ((row.platform !== "android" && row.platform !== "ios") ||
        !version(major) || (row.os_minor !== null && row.os_minor !== undefined && !version(row.os_minor)) ||
        (row.model !== null && row.model !== undefined && typeof row.model !== "string") ||
        (row.id !== null && row.id !== undefined && !isDeviceId(row.id))) return { error: "device" };
    if (platforms.has(row.platform) || (row.id && ids.has(row.id))) return { error: "devices" };
    platforms.add(row.platform); if (row.id) ids.add(row.id);
    devices.push({ ...(row.id ? { id: row.id } : {}), platform: row.platform, os_major: major,
      os_minor: knownOsMajorVersion(major) === null ? null : row.os_minor ?? null, model: row.model?.trim() || null });
  }
  return { input: { display_name: string("display_name") || null, country_code: country, testing_email: email, initial_intent: intent, devices } };
}
