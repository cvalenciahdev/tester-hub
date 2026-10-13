import { NextResponse, type NextRequest } from "next/server";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { isAuthServiceUnavailableError } from "@/lib/supabase/auth-errors";
import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function redirectToLogin(request: NextRequest, error: "oauth_callback" | "service_unavailable") {
  return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const supabase = await createClient();

  if (!code) {
    return redirectToLogin(request, "oauth_callback");
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (isAuthRetryableFetchError(error)) {
      return redirectToLogin(request, "service_unavailable");
    }

    console.error("Supabase OAuth callback failed:", error);
    return redirectToLogin(request, "oauth_callback");
  }

  let user: User | null;

  try {
    user = await getCurrentUser(supabase);
  } catch (error) {
    if (isAuthServiceUnavailableError(error)) {
      return redirectToLogin(request, "service_unavailable");
    }

    throw error;
  }

  if (!user) {
    return redirectToLogin(request, "oauth_callback");
  }

  const { complete } = await getOnboardingStatus(supabase, user.id);
  return NextResponse.redirect(
    new URL(complete ? "/dashboard" : "/onboarding", request.url),
  );
}
