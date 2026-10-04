"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type OnboardingFormState = {
  error?: "invalidCountry" | "invalidEmail" | "invalidIntent" | "invalidDevice" | "saveFailed";
};

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseDevice(formData: FormData, platform: "android" | "ios") {
  const prefix = platform;
  const osMajorValue = readString(formData, `${prefix}_os_major`);
  const osMinorValue = readString(formData, `${prefix}_os_minor`);
  const model = readString(formData, `${prefix}_model`);

  if (!/^(0|[1-9]\d*)$/.test(osMajorValue)) {
    return null;
  }

  const osMajor = Number(osMajorValue);
  if (!Number.isSafeInteger(osMajor) || osMajor > 32767) {
    return null;
  }

  let osMinor: number | null = null;
  if (osMinorValue) {
    if (!/^(0|[1-9]\d*)$/.test(osMinorValue)) {
      return null;
    }
    osMinor = Number(osMinorValue);
    if (!Number.isSafeInteger(osMinor) || osMinor > 32767) {
      return null;
    }
  }

  return {
    platform,
    os_major: osMajor,
    os_minor: osMinor,
    model: model || null,
  };
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
  if (!/^[A-Z]{2}$/.test(countryCode)) {
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

  const devices = platforms.map((platform) => parseDevice(formData, platform));
  if (devices.some((device) => device === null)) {
    return { error: "invalidDevice" };
  }

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
