"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { T, useI18n } from "@/lib/i18n";

export default function CampaignFormPage() {
  const { t } = useI18n();

  return (
    <>
      <Link className="back-link" href="/campaigns"><ArrowLeft size={16} /> <T id="campaignForm.back" /></Link>
      <PageHeading title={<T id="campaignForm.title" />} />
      <div className="campaign-form-layout">
        <form className="panel campaign-form">
          <section className="form-section"><div className="form-section-heading"><span className="section-number">01</span><div><h2><T id="campaignForm.general" /></h2><p><T id="campaignForm.generalDescription" /></p></div></div>
            <div className="form-grid"><label className="field field-full"><span><T id="campaignForm.campaignName" /> <b>*</b></span><input placeholder={t("campaignForm.namePlaceholder")} /></label><label className="field field-full"><span><T id="campaignForm.campaignDescription" /> <b>*</b></span><textarea rows={4} placeholder={t("campaignForm.descriptionPlaceholder")} /><small><T id="campaignForm.descriptionHelp" /></small></label><label className="field"><span><T id="campaignForm.application" /> <b>*</b></span><select defaultValue=""><option value="" disabled>{t("campaignForm.selectApp")}</option><option>Daylight Journal</option><option>Mori Habits</option><option>Northstar</option></select></label><label className="field"><span><T id="campaignForm.platform" /> <b>*</b></span><select defaultValue=""><option value="" disabled>{t("campaignForm.selectPlatform")}</option><option>Android</option><option>iOS</option><option>{t("campaignForm.androidIos")}</option></select></label></div>
          </section>
          <section className="form-section"><div className="form-section-heading"><span className="section-number">02</span><div><h2><T id="campaignForm.requirements" /></h2><p><T id="campaignForm.requirementsDescription" /></p></div></div>
            <div className="form-grid"><label className="field"><span><T id="common.countries" /> <b>*</b></span><select defaultValue=""><option value="" disabled>{t("campaignForm.selectCountries")}</option><option>España</option><option>México</option><option>Argentina</option><option>España, México</option></select></label><label className="field"><span><T id="common.minimumVersion" /></span><input placeholder={t("campaignForm.minimumVersionPlaceholder")} /></label><label className="field"><span><T id="campaignForm.targetTesters" /> <b>*</b></span><input type="number" placeholder="20" /></label><label className="field"><span><T id="common.duration" /> <b>*</b></span><select defaultValue=""><option value="" disabled>{t("campaignForm.selectDuration")}</option><option>7 {t("campaignForm.days")}</option><option>14 {t("campaignForm.days")}</option><option>21 {t("campaignForm.days")}</option><option>30 {t("campaignForm.days")}</option></select></label></div>
          </section>
          <section className="form-section"><div className="form-section-heading"><span className="section-number">03</span><div><h2><T id="campaignForm.accessInstructions" /></h2><p><T id="campaignForm.accessDescription" /></p></div></div>
            <div className="form-grid"><label className="field field-full"><span><T id="campaignForm.storeUrl" /></span><input type="url" placeholder="https://apps.apple.com/..." /></label><label className="field field-full"><span><T id="campaignForm.instructions" /> <b>*</b></span><textarea rows={5} placeholder={t("campaignForm.instructionsPlaceholder")} /></label></div>
          </section>
          <div className="form-actions"><Link className="button button-quiet" href="/campaigns"><T id="common.cancel" /></Link><button className="button button-secondary" type="button"><T id="campaignForm.saveDraft" /></button><Link className="button button-primary" href="/campaigns"><T id="campaignForm.publish" /> <ArrowRight size={16} /></Link></div>
        </form>
        <aside className="panel form-aside"><div className="aside-icon"><Info size={18} /></div><h3><T id="campaignForm.adviceTitle" /></h3><p><T id="campaignForm.adviceDescription" /></p><div className="aside-check"><span>✓</span><p><strong><T id="campaignForm.goodStart" /></strong><br /><T id="campaignForm.goodStartDescription" /></p></div><div className="aside-check"><span>✓</span><p><strong><T id="campaignForm.testerCare" /></strong><br /><T id="campaignForm.testerCareDescription" /></p></div></aside>
      </div>
    </>
  );
}
