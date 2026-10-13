import { redirect } from "next/navigation";
import { Check, FlaskConical, UsersRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { LanguageSelector, T } from "@/lib/i18n";
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button";
import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { isAuthServiceUnavailableError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { error } = await searchParams;
  let user: User | null;

  try {
    user = await getCurrentUser(supabase);
  } catch (error) {
    if (isAuthServiceUnavailableError(error)) {
      return <ServiceUnavailable />;
    }

    throw error;
  }

  if (user) {
    const { complete } = await getOnboardingStatus(supabase, user.id);
    redirect(complete ? "/dashboard" : "/onboarding");
  }

  if (error === "service_unavailable") {
    return <ServiceUnavailable />;
  }

  return (
    <main className="auth-page">
      <div className="auth-header">
        <div className="auth-brand">
          <span className="brand-symbol">
            <FlaskConical size={18} />
          </span>
          tester<span className="brand-light">hub</span>
        </div>

        <div className="auth-language">
          <LanguageSelector />
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-icon">
          <UsersRound size={22} />
        </div>

        <div className="eyebrow">
          <T id="auth.eyebrow" />
        </div>

        <h1>
          <T id="auth.title" />
        </h1>

        <p className="auth-description">
          <T id="auth.description" />
        </p>

        <GoogleOAuthButton />

        {error === "oauth_callback" && (
          <p className="auth-error" role="alert">
            <T id="auth.googleError" />
          </p>
        )}

        <div className="auth-benefits">
          <span>
            <Check size={15} />
            <T id="auth.benefitOne" />
          </span>
          <span>
            <Check size={15} />
            <T id="auth.benefitTwo" />
          </span>
        </div>

      </div>
    </main>
  );
}