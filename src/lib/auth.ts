import "server-only";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { isCountryCode } from "@/lib/countries";
import {
  AuthServiceUnavailableError,
  isUnauthenticatedAuthError,
} from "@/lib/supabase/auth-errors";

import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type OnboardingProfile = {
  display_name: string | null;
  country_code: string | null;
  testing_email: string | null;
  initial_intent: "tester" | "developer" | "both" | null;
};

export async function getCurrentUser(
  supabase: SupabaseServerClient,
): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (isAuthRetryableFetchError(error)) {
      throw new AuthServiceUnavailableError();
    }

    if (!isUnauthenticatedAuthError(error)) {
      throw error;
    }
  }

  return error ? null : data.user;
}

export async function getOnboardingStatus(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<{ complete: boolean; profile: OnboardingProfile | null }> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, country_code, testing_email, initial_intent")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return { complete: false, profile: null };
  }

  const { count, error: devicesError } = await supabase
    .from("user_devices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (devicesError) {
    throw devicesError;
  }

  return {
    complete:
      isCountryCode(profile.country_code) &&
      profile.testing_email !== null &&
      profile.testing_email.trim().length > 0 &&
      profile.initial_intent !== null &&
      (count ?? 0) > 0,
    profile,
  };
}

export function getUserDisplayName(
  user: User,
  profile: OnboardingProfile | null,
): string {
  const metadataName =
    user.user_metadata.full_name ?? user.user_metadata.name;

  return (
    profile?.display_name?.trim() ||
    (typeof metadataName === "string" ? metadataName.trim() : "") ||
    user.email ||
    "Tester Hub"
  );
}

export function getUserInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length > 1
      ? `${words[0][0]}${words[words.length - 1][0]}`
      : words[0]?.slice(0, 2);

  return initials?.toUpperCase() || "TH";
}
