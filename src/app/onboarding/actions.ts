"use server";

import { redirect } from "next/navigation";
import { knownOsMajorVersion, unknownDevice } from "@/lib/device-os";
import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isCountryCode } from "@/lib/countries";

export type OnboardingFormState = {
  error?: "invalidCountry" | "invalidEmail" | "invalidIntent" | "invalidDevice" | "saveFailed";
};

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function completeOnboarding(
  _previousState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { complete } = await getOnboardingStatus(supabase, user.id);
  if (complete) {
    redirect("/dashboard");
  }

  const countryCode = readString(formData, "country_code").toUpperCase();
  if (!isCountryCode(countryCode)) {
    return { error: "invalidCountry" };
  }

  const testingEmail = readString(formData, "testing_email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testingEmail)) {
    return { error: "invalidEmail" };
  }

  const initialIntent = readString(formData, "initial_intent");
  if (!["tester", "developer", "both"].includes(initialIntent)) {
    return { error: "invalidIntent" };
  }

  const platformChoice = readString(formData, "platform");
  const platforms =
    platformChoice === "both"
      ? ["android", "ios"] as const
      : platformChoice === "android" || platformChoice === "ios"
        ? [platformChoice] as const
        : null;

  if (!platforms) {
    return { error: "invalidDevice" };
  }

  // Removed version/model fields are not trusted inputs. Preserve metadata
  // only from this authenticated user's stored devices.
  const { data: existingDevices, error: devicesError } = await supabase
    .from("user_devices")
    .select("platform, os_major, os_minor, model")
    .eq("user_id", user.id);
  if (devicesError || !Array.isArray(existingDevices)) {
    return { error: "saveFailed" };
  }
  const devices = platforms.map((platform) => {
    const existing = existingDevices.find((device) => device.platform === platform);
    if (!existing) return unknownDevice(platform);
    if (knownOsMajorVersion(existing.os_major) === null) {
      return { ...unknownDevice(platform), model: existing.model };
    }
    return { platform, os_major: existing.os_major, os_minor: existing.os_minor, model: existing.model };
  });

  const { error } = await supabase.rpc("complete_onboarding", {
    p_country_code: countryCode,
    p_testing_email: testingEmail,
    p_initial_intent: initialIntent,
    p_devices: devices,
  });

  if (error) {
    console.error("Could not complete onboarding:", error);
    return { error: "saveFailed" };
  }

  redirect("/dashboard");
}
