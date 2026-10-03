import Link from "next/link";
import { ArrowRight, ChevronRight, LockKeyhole, Mail, MapPin, Smartphone } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { CurrentLanguageName, T } from "@/lib/i18n";

export default function ProfilePage() {
  return (
    <>
      <PageHeading eyebrow={<T id="profile.eyebrow" />} title={<T id="profile.title" />} description={<T id="profile.description" />} action={<button className="button button-primary" type="button"><T id="profile.save" /></button>} />
      <div className="profile-layout">
        <div className="profile-main">
          <section className="panel profile-card"><div className="profile-section-head"><div><h2><T id="profile.personalInfo" /></h2><p><T id="profile.personalDescription" /></p></div><button className="quiet-link"><T id="common.edit" /></button></div><div className="profile-identity"><span className="profile-big-avatar">AM</span><div><strong>Alex Morgan</strong><span><T id="profile.memberSince" /></span></div><span className="role-pill"><T id="profile.role" /></span></div><div className="profile-fields"><div><small><T id="profile.name" /></small><strong>Alex Morgan</strong></div><div><small><T id="profile.email" /></small><strong>alex.morgan@example.test</strong></div><div><small><T id="profile.country" /></small><strong><MapPin size={15} /> España</strong></div><div><small><T id="profile.language" /></small><strong><CurrentLanguageName /></strong></div></div></section>
          <section className="panel profile-card"><div className="profile-section-head"><div><h2><T id="profile.devices" /></h2><p><T id="profile.devicesDescription" /></p></div><button className="quiet-link"><T id="profile.addDevice" /></button></div><div className="device-list"><div className="device-row"><span className="device-round"><Smartphone size={19} /></span><span><strong>iPhone 15 Pro</strong><small>iOS 18.0 · <T id="profile.primaryDevice" /></small></span><span className="device-badge"><T id="profile.primary" /></span><ChevronRight size={17} /></div><div className="device-row"><span className="device-round"><Smartphone size={19} /></span><span><strong>Pixel 8</strong><small>Android 15 · <T id="profile.addedTwoWeeks" /></small></span><ChevronRight size={17} /></div></div></section>
          <section className="panel profile-card"><div className="profile-section-head"><div><h2><T id="profile.testingEmail" /></h2><p><T id="profile.testingEmailDescription" /></p></div><button className="quiet-link"><T id="common.edit" /></button></div><div className="testing-email"><span><Mail size={18} /></span><div><strong>alex.morgan@example.test</strong><small><T id="profile.verifiedStores" /></small></div></div></section>
        </div>
        <aside className="profile-side">
          <section className="panel security-card"><span className="security-icon"><LockKeyhole size={18} /></span><h3><T id="profile.privacyTitle" /></h3><p><T id="profile.privacyDescription" /></p><Link href="/onboarding"><T id="profile.reviewData" /> <ArrowRight size={14} /></Link></section>
          <div className="profile-demo-note"><T id="profile.demoData" /></div>
        </aside>
      </div>
    </>
  );
}
