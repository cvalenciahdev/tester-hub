"use client";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { T, type TranslationKey } from "@/lib/i18n";
import type { OwnCampaign } from "@/lib/own-campaigns";
import type { CampaignError, CampaignResult } from "@/lib/campaign-input";
import { createCampaign, mutateCampaign } from "./actions";

const errors: Record<CampaignError, TranslationKey> = {
  auth: "roundForm.errorAuth", unavailable: "roundForm.errorUnavailable", archived: "roundForm.errorArchived",
  state: "roundForm.errorState", locked: "roundForm.errorLocked", target: "roundForm.errorTarget",
  duration: "roundForm.errorDuration", os: "roundForm.errorOs", countries: "roundForm.errorCountries",
  platform: "roundForm.errorPlatform", failed: "roundForm.errorFailed",
};
export function CampaignForm({ appId, campaign }: { appId: string; campaign?: OwnCampaign }) {
  const inFlight = useRef(false);
  const [allCountries, setAllCountries] = useState(campaign?.all_countries ?? false);
  const [state, action, pending] = useActionState<CampaignResult, FormData>(async (_previous, form) => {
    try { return campaign ? await mutateCampaign(campaign.id, form) : await createCampaign(appId, form); }
    finally { inFlight.current = false; }
  }, {});
  const terminal = campaign?.status === "completed" || campaign?.status === "cancelled";
  const readOnly = terminal || campaign?.archived === true;
  const locked = campaign?.has_participations === true;
  const disabled = pending || readOnly;
  function submit(event: React.FormEvent<HTMLFormElement>) {
    if (pending || inFlight.current) event.preventDefault();
    else inFlight.current = true;
  }
  return <div className="campaign-form-layout">
    <div>
      <form className="panel campaign-form" action={action} onSubmit={submit} aria-busy={pending}>
        <section className="form-section">
          <div className="form-section-heading"><span className="section-number">01</span><div><h2><T id="campaignForm.general" /></h2></div></div>
          <div className="form-grid">
            <label className="field"><span><T id="campaignForm.platform" /></span><select name="platform" defaultValue={campaign?.platform ?? "android"} disabled={disabled || locked}><option value="android">Android</option><option value="ios">iOS</option></select></label>
            <label className="field"><span><T id="campaignForm.targetTesters" /></span><input name="target_testers" type="number" min={Math.max(1, campaign?.covered_testers ?? 0)} max={2147483647} step={1} required defaultValue={campaign?.target_testers ?? 1} disabled={disabled} /></label>
          </div>
        </section>
        <section className="form-section">
          <div className="form-section-heading"><span className="section-number">02</span><div><h2><T id="campaignForm.requirements" /></h2></div></div>
          <div className="form-grid">
            <label className="field field-full"><span><input type="checkbox" name="all_countries" checked={allCountries} onChange={(event) => setAllCountries(event.target.checked)} disabled={disabled || locked} /> <T id="dashboard.allCountries" /></span></label>
            <label className="field field-full"><span><T id="common.countries" /></span><input name="country_codes" defaultValue={campaign?.country_codes.join(", ") ?? ""} required={!allCountries} disabled={disabled || locked || allCountries} placeholder="ES, MX" /><small><T id="roundForm.countryHelp" /></small></label>
            <label className="field"><span><T id="roundForm.osMajor" /></span><input name="min_os_major" type="number" min={0} max={32767} step={1} defaultValue={campaign?.min_os_major ?? ""} disabled={disabled || locked} /></label>
            <label className="field"><span><T id="roundForm.osMinor" /></span><input name="min_os_minor" type="number" min={0} max={32767} step={1} defaultValue={campaign?.min_os_minor ?? ""} disabled={disabled || locked} /></label>
            <label className="field"><span><T id="common.duration" /> (<T id="campaignForm.days" />)</span><input name="duration_days" type="number" min={1} max={2147483647} step={1} required defaultValue={campaign?.duration_days ?? 14} disabled={disabled || locked} /></label>
          </div>
          <p className="muted-cell"><T id="roundForm.osHelp" /></p>
          {locked && <p className="muted-cell"><T id="roundForm.locked" /></p>}
        </section>
        <section className="form-section">
          <div className="form-section-heading"><span className="section-number">03</span><div><h2><T id="campaignForm.accessInstructions" /></h2></div></div>
          <div className="form-grid">
            <label className="field field-full"><span><T id="campaignForm.storeUrl" /></span><input name="store_url" defaultValue={campaign?.store_url ?? ""} disabled={disabled} /></label>
            <label className="field field-full"><span><T id="campaignForm.instructions" /></span><textarea name="instructions" rows={5} defaultValue={campaign?.instructions ?? ""} disabled={disabled} /></label>
          </div>
        </section>
        <div className="form-actions">
          <Link className="button button-quiet" href={`/apps/${appId}/campaigns`}><T id="apps.backToCampaigns" /></Link>
          {!readOnly && <button className="button button-primary" name="operation" value="save" type="submit" disabled={pending}><T id={campaign ? "apps.saveChanges" : "campaignForm.saveDraft"} /></button>}
        </div>
      </form>
      {state.error && <p role="alert"><T id={errors[state.error]} /></p>}
      {state.saved && <p role="status"><T id="roundForm.saved" /></p>}
      {pending && <p role="status"><T id="apps.saving" /></p>}
    </div>
    <aside className="panel form-aside">
      <h3><T id="roundForm.lifecycle" /></h3>
      {readOnly && <p><T id={terminal ? "roundForm.terminal" : "roundForm.errorArchived"} /></p>}
      {!campaign && <p><T id="roundForm.draftHelp" /></p>}
      {campaign?.status === "draft" && !campaign.archived && <form action={action} onSubmit={submit} aria-busy={pending}>
        <p><T id="roundForm.publishHelp" /></p>
        <button className="button button-primary" name="operation" value="publish" disabled={pending}><T id="campaignForm.publish" /></button>
      </form>}
      {campaign && !terminal && <details>
        <summary><T id="roundForm.cancel" /></summary>
        <form action={action} onSubmit={submit} aria-busy={pending}>
          <label className="field"><span><T id="roundForm.reason" /></span><textarea name="reason" rows={3} disabled={pending} /></label>
          <p><T id="roundForm.cancelHelp" /></p>
          <button className="button button-secondary" name="operation" value="cancel" disabled={pending}><T id="roundForm.cancel" /></button>
        </form>
      </details>}
    </aside>
  </div>;
}
