import { redirect } from "next/navigation";
import { Check, FlaskConical } from "lucide-react";
import { LanguageSelector, T } from "@/lib/i18n";
import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { complete, profile } = await getOnboardingStatus(supabase, user.id);

  if (complete) {
    redirect("/dashboard");
  }

  const { data: devices, error } = await supabase
    .from("user_devices")
    .select("platform, os_major, os_minor, model")
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <div className="brand">
          <span className="brand-symbol"><FlaskConical size={18} /></span>
          <span>tester<span className="brand-light">hub</span></span>
        </div>
        <div className="step-indicator">
          <span className="step-dot step-done"><Check size={13} /></span>
          <span className="step-line" />
          <span className="step-dot step-current">2</span>
          <span className="step-line" />
          <span className="step-dot">3</span>
          <span className="step-text"><T id="onboarding.step" /></span>
        </div>
        <div className="onboarding-header-actions"><LanguageSelector /></div>
      </header>
      <div className="onboarding-wrap">
        <div className="onboarding-copy">
          <div className="eyebrow"><T id="onboarding.eyebrow" /></div>
          <h1><T id="onboarding.title" /></h1>
          <p><T id="onboarding.intro" /></p>
          <div className="onboarding-note">
            <div>
              <strong><T id="onboarding.privacyTitle" /></strong>
              <p><T id="onboarding.privacyDescription" /></p>
            </div>
          </div>
        </div>
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2><T id="onboarding.configTitle" /></h2>
              <p><T id="onboarding.configDescription" /></p>
            </div>
            <span className="optional-label">2 min</span>
          </div>
          <OnboardingForm profile={profile} devices={devices ?? []} />
        </section>
      </div>
    </main>
  );
}
