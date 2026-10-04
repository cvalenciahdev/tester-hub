import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const supabase = await createClient();

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_callback", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Supabase OAuth callback failed:", error);
    return NextResponse.redirect(new URL("/login?error=oauth_callback", request.url));
  }

  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=oauth_callback", request.url));
  }

  const { complete } = await getOnboardingStatus(supabase, user.id);
  return NextResponse.redirect(
    new URL(complete ? "/dashboard" : "/onboarding", request.url),
  );
}
