import Link from "next/link";
import { ArrowRight, Check, FlaskConical, UsersRound } from "lucide-react";
import { LanguageSelector, T } from "@/lib/i18n";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-language"><LanguageSelector /></div>
      <div className="auth-brand"><span className="brand-symbol"><FlaskConical size={18} /></span> tester<span className="brand-light">hub</span></div>
      <div className="auth-card">
        <div className="auth-icon"><UsersRound size={22} /></div>
        <div className="eyebrow"><T id="auth.eyebrow" /></div>
        <h1><T id="auth.title" /></h1>
        <p className="auth-description"><T id="auth.description" /></p>
        <button className="google-button"><span className="google-g">G</span><T id="auth.continueGoogle" /></button>
        <div className="auth-divider"><span /><T id="auth.or" /><span /></div>
        <Link className="button button-primary button-full" href="/onboarding"><T id="auth.explorePrototype" /> <ArrowRight size={16} /></Link>
        <div className="auth-benefits">
          <span><Check size={15} /> <T id="auth.benefitOne" /></span>
          <span><Check size={15} /> <T id="auth.benefitTwo" /></span>
        </div>
        <p className="auth-terms"><T id="auth.termsPrefix" /> <a href="#terms"><T id="auth.terms" /></a> <T id="auth.and" /> <a href="#privacy"><T id="auth.privacy" /></a>.</p>
      </div>
      <div className="auth-footer"><T id="auth.haveAccount" /> <Link href="/dashboard"><T id="auth.enterDemo" /> <ArrowRight size={14} /></Link></div>
    </main>
  );
}
