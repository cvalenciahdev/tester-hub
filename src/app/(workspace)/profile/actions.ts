"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { parseProfileInput, type ProfileResult, type ProfileError } from "@/lib/profile-input";
import { createClient } from "@/lib/supabase/server";

export async function updateMyProfile(form: FormData): Promise<ProfileResult> {
  const parsed = parseProfileInput(form);
  if (!parsed.input) return { error: parsed.error ?? "failed" };
  try {
    const supabase = await createClient();
    if (!await getCurrentUser(supabase)) return { error: "auth" };
    const input = parsed.input;
    const { error } = await supabase.rpc("update_my_profile", { p_display_name: input.display_name, p_country_code: input.country_code,
      p_testing_email: input.testing_email, p_initial_intent: input.initial_intent, p_devices: input.devices });
    if (error) {
      const errors: Record<string, ProfileError> = { NOT_AUTHENTICATED: "auth", PROFILE_NOT_FOUND: "missing", INVALID_COUNTRY_CODE: "country",
        INVALID_TESTING_EMAIL: "email", INITIAL_INTENT_REQUIRED: "intent", INVALID_DEVICES: "devices", DUPLICATE_PLATFORM: "devices",
        INVALID_DEVICE: "device", DEVICE_NOT_OWNED: "ownership" };
      return { error: errors[error.message] ?? "failed" };
    }
  } catch { return { error: "failed" }; }
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { saved: true };
}
