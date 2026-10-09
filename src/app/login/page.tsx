import { redirect } from "next/navigation";
import { Check, FlaskConical, UsersRound } from "lucide-react";
import { LanguageSelector, T } from "@/lib/i18n";
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button";
import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (user) {
    const { complete } = await getOnboardingStatus(supabase, user.id);
    redirect(complete ? "/dashboard" : "/onboarding");
  }

  const { error } = await searchParams;

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