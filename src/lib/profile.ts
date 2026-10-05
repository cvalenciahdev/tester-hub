import "server-only";
import { getCurrentUser, type OnboardingProfile } from "@/lib/auth";
import { isDeviceId, validEmail, type ProfileDevice } from "@/lib/profile-input";
import { createClient } from "@/lib/supabase/server";

export type OwnProfile = OnboardingProfile & { created_at: string };
export type ProfileData = { profile: OwnProfile; devices: (ProfileDevice & { id: string })[]; complete: boolean; anomalous: boolean };
export async function getProfileData(): Promise<ProfileData | null> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return null;
  const { data: profile, error } = await supabase.from("profiles")
    .select("display_name,country_code,testing_email,initial_intent,created_at").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Profile could not be loaded.");
  if (!profile) return null;
  const devices: (ProfileDevice & { id: string })[] = [];
  for (let from = 0; ; from += 500) {
    const result = await supabase.from("user_devices").select("id,platform,os_major,os_minor,model")
      .eq("user_id", user.id).order("created_at").order("id").range(from, from + 499);
    if (result.error || !Array.isArray(result.data)) throw new Error("Devices could not be loaded.");
    for (const row of result.data) {
      if (!isDeviceId(row.id) || (row.platform !== "android" && row.platform !== "ios") || !Number.isInteger(row.os_major) ||
          row.os_major < 0 || row.os_major > 32767 || (row.os_minor !== null && (!Number.isInteger(row.os_minor) || row.os_minor < 0 || row.os_minor > 32767)) ||
          (row.model !== null && typeof row.model !== "string")) throw new Error("Invalid device response.");
      devices.push({ id: row.id, platform: row.platform, os_major: row.os_major, os_minor: row.os_minor, model: row.model });
    }
    if (result.data.length < 500) break;
  }
  if (!Number.isFinite(Date.parse(profile.created_at)) ||
      !["tester", "developer", "both", null].includes(profile.initial_intent) ||
      [profile.display_name, profile.country_code, profile.testing_email].some((value) => value !== null && typeof value !== "string")) throw new Error("Invalid profile response.");
  const complete = profile.country_code !== null && profile.testing_email !== null && profile.testing_email.trim().length > 0 && profile.initial_intent !== null && devices.length > 0;
  const anomalous = !complete || !/^[A-Z]{2}$/.test(profile.country_code ?? "") || !validEmail(profile.testing_email ?? "") ||
    devices.length > 2 || new Set(devices.map((device) => device.platform)).size !== devices.length;
  return { profile: { display_name: profile.display_name, country_code: profile.country_code, testing_email: profile.testing_email,
    initial_intent: profile.initial_intent, created_at: profile.created_at }, devices, complete, anomalous };
}
