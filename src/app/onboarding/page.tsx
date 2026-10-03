"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, FlaskConical } from "lucide-react";
import { LanguageSelector, T, useI18n } from "@/lib/i18n";

export default function OnboardingPage() {
  const { t } = useI18n();

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link className="brand" href="/login"><span className="brand-symbol"><FlaskConical size={18} /></span><span>tester<span className="brand-light">hub</span></span></Link>
        <div className="step-indicator"><span className="step-dot step-done"><Check size={13} /></span><span className="step-line" /><span className="step-dot step-current">2</span><span className="step-line" /><span className="step-dot">3</span><span className="step-text"><T id="onboarding.step" /></span></div>
        <div className="onboarding-header-actions"><LanguageSelector /><Link className="skip-link" href="/dashboard"><T id="onboarding.skip" /></Link></div>
      </header>
      <div className="onboarding-wrap">
        <div className="onboarding-copy">
          <div className="eyebrow"><T id="onboarding.eyebrow" /></div>
          <h1><T id="onboarding.title" /></h1>
          <p><T id="onboarding.intro" /></p>
          <div className="onboarding-note"><div><strong><T id="onboarding.privacyTitle" /></strong><p><T id="onboarding.privacyDescription" /></p></div></div>
        </div>
        <section className="form-card">
          <div className="form-card-heading"><div><h2><T id="onboarding.configTitle" /></h2><p><T id="onboarding.configDescription" /></p></div><span className="optional-label">2 min</span></div>
          <div className="form-grid">
            <label className="field"><span><T id="onboarding.country" /> <b>*</b></span><select defaultValue=""><option value="" disabled><T id="onboarding.selectCountry" /></option><option>España</option><option>México</option><option>Argentina</option><option>Chile</option><option>Colombia</option></select></label>
            <label className="field"><span><T id="onboarding.mainPlatform" /> <b>*</b></span><select defaultValue=""><option value="" disabled><T id="onboarding.selectPlatform" /></option><option>Android</option><option>iOS</option><option><T id="onboarding.both" /></option></select></label>
            <label className="field"><span><T id="onboarding.systemVersion" /></span><input placeholder={t("onboarding.systemVersionPlaceholder")} /></label>
            <label className="field"><span><T id="onboarding.deviceModel" /> <small><T id="onboarding.optional" /></small></span><input placeholder={t("onboarding.devicePlaceholder")} /></label>
            <label className="field field-full"><span><T id="onboarding.testingEmail" /> <b>*</b></span><input type="email" placeholder={t("onboarding.testingEmailPlaceholder")} /><small><T id="onboarding.testingEmailHelp" /></small></label>
          </div>
          <fieldset className="intent-options"><legend><T id="onboarding.intentQuestion" /></legend><label><input type="radio" name="intent" defaultChecked /><span><strong><T id="onboarding.tryApps" /></strong><small><T id="onboarding.tryAppsDescription" /></small></span></label><label><input type="radio" name="intent" /><span><strong><T id="onboarding.findTesters" /></strong><small><T id="onboarding.findTestersDescription" /></small></span></label><label><input type="radio" name="intent" /><span><strong><T id="onboarding.both" /></strong><small><T id="onboarding.bothDescription" /></small></span></label></fieldset>
          <div className="form-actions"><Link className="button button-quiet" href="/login"><ArrowLeft size={16} /> <T id="onboarding.back" /></Link><Link className="button button-primary" href="/dashboard"><T id="onboarding.continue" /> <ArrowRight size={16} /></Link></div>
        </section>
      </div>
    </main>
  );
}
