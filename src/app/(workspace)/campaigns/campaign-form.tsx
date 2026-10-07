"use client";
import Link from "next/link";
import { InlineLoading, PendingButtonContent } from "@/components/loading-state";
import { useActionState, useRef, useState, type ChangeEvent } from "react";
import { T, type TranslationKey } from "@/lib/i18n";
import type { OwnCampaign } from "@/lib/own-campaigns";
import type { CampaignError, CampaignResult } from "@/lib/campaign-input";
import { createCampaign, mutateCampaign } from "./actions";
import styles from "./campaign-editor.module.css";

const errors: Record<CampaignError, TranslationKey> = {
  auth: "roundForm.errorAuth", unavailable: "roundForm.errorUnavailable", archived: "roundForm.errorArchived",
  state: "roundForm.errorState", locked: "roundForm.errorLocked", target: "roundForm.errorTarget",
  duration: "roundForm.errorDuration", os: "roundForm.errorOs", countries: "roundForm.errorCountries",
  platform: "roundForm.errorPlatform", failed: "roundForm.errorFailed",
};
export function CampaignForm({ appId, campaign }: { appId: string; campaign?: OwnCampaign }) {
  const inFlight = useRef(false);
  const [allCountries, setAllCountries] = useState(campaign?.all_countries ?? false);
  const [creatingOperation, setCreatingOperation] = useState("save");
  // React resets successful action forms even when the result carries a validation error.
  // Keep creation values controlled so an RPC error never discards the user's input.
  const [creationValues, setCreationValues] = useState<Record<string, string>>({
    platform: "android", target_testers: "1", country_codes: "", min_os_major: "",
    min_os_minor: "", duration_days: "14", store_url: "", instructions: "",
  });
  function fieldValue(name: string, defaultValue: string | number) {
    return campaign ? { defaultValue } : { value: creationValues[name], onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setCreationValues((current) => ({ ...current, [name]: value }));
    } };
  }
  const [state, action, pending] = useActionState<CampaignResult, FormData>(async (_previous, form) => {
    try { return campaign ? await mutateCampaign(campaign.id, form) : await createCampaign(appId, form); }
    finally { inFlight.current = false; }
  }, {});
  const terminal = campaign?.status === "completed" || campaign?.status === "cancelled";
  const readOnly = terminal || campaign?.archived === true;
  const locked = campaign?.has_participations === true;
  const creationFinished = !campaign && !!state.createdCampaign;
  const disabled = pending || readOnly || creationFinished;
  function submit(event: React.FormEvent<HTMLFormElement>) {
    if (pending || inFlight.current || creationFinished) event.preventDefault();
    else {
      inFlight.current = true;
      if (!campaign) setCreatingOperation((event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "save");
    }
  }
  return <div className={styles.editLayout}>
    <div>
      <form className="panel campaign-form" action={action} onSubmit={submit} aria-busy={pending}>
        <section className="form-section">
          <div className="form-section-heading"><div><h2><T id={campaign ? "campaignForm.general" : "roundForm.newGeneral"} /></h2></div></div>
          <div className="form-grid">
            <label className="field"><span><T id="campaignForm.platform" /></span><select name="platform" {...fieldValue("platform", campaign?.platform ?? "android")} disabled={disabled || locked}><option value="android">Android</option><option value="ios">iOS</option></select></label>
            <label className="field"><span><T id="campaignForm.targetTesters" /></span><input name="target_testers" type="number" min={Math.max(1, campaign?.covered_testers ?? 0)} max={2147483647} step={1} required {...fieldValue("target_testers", campaign?.target_testers ?? 1)} disabled={disabled} /></label>
          </div>
        </section>
        <section className="form-section">
          <div className="form-section-heading"><div><h2><T id={campaign ? "campaignForm.requirements" : "roundForm.newRequirements"} /></h2></div></div>
          <div className="form-grid">
            <label className="field field-full"><span><input type="checkbox" name="all_countries" checked={allCountries} onChange={(event) => setAllCountries(event.target.checked)} disabled={disabled || locked} /> <T id="dashboard.allCountries" /></span></label>
            <label className="field field-full"><span><T id="common.countries" /></span><input name="country_codes" {...fieldValue("country_codes", campaign?.country_codes.join(", ") ?? "")} required={!allCountries} disabled={disabled || locked || allCountries} placeholder="ES, MX" /><small><T id="roundForm.countryHelp" /></small></label>
            <label className="field"><span><T id="roundForm.osMajor" /></span><input name="min_os_major" type="number" min={0} max={32767} step={1} {...fieldValue("min_os_major", campaign?.min_os_major ?? "")} disabled={disabled || locked} /></label>
            <label className="field"><span><T id="roundForm.osMinor" /></span><input name="min_os_minor" type="number" min={0} max={32767} step={1} {...fieldValue("min_os_minor", campaign?.min_os_minor ?? "")} disabled={disabled || locked} /></label>
            <label className="field"><span><T id="common.duration" /> (<T id="campaignForm.days" />)</span><input name="duration_days" type="number" min={1} max={2147483647} step={1} required {...fieldValue("duration_days", campaign?.duration_days ?? 14)} disabled={disabled || locked} /></label>
          </div>
          <p className={styles.versionHelp}><T id="roundForm.osHelp" /></p>
          {locked && <p className="muted-cell"><T id="roundForm.locked" /></p>}
        </section>
        <section className="form-section">
          <div className="form-section-heading"><div><h2><T id="campaignForm.accessInstructions" /></h2></div></div>
          <div className="form-grid">
            <label className="field field-full"><span><T id="campaignForm.storeUrl" /></span><input name="store_url" {...fieldValue("store_url", campaign?.store_url ?? "")} disabled={disabled} /></label>
            <label className="field field-full"><span><T id="campaignForm.instructions" /></span><textarea name="instructions" rows={5} {...fieldValue("instructions", campaign?.instructions ?? "")} disabled={disabled} /></label>
          </div>
        </section>
        <div className={`form-actions ${styles.saveActions}`}>
          {!readOnly && <button className={`button ${campaign ? "button-primary" : "button-secondary"}`} name="operation" value="save" type="submit" disabled={pending || creationFinished}><PendingButtonContent pending={pending && (campaign !== undefined || creatingOperation === "save")} label="apps.saving" announce={false}><T id={campaign ? "apps.saveChanges" : "campaignForm.saveDraft"} /></PendingButtonContent></button>}
          {!campaign && <button className="button button-primary" name="operation" value="publish" type="submit" disabled={pending || creationFinished}><PendingButtonContent pending={pending && creatingOperation === "publish"} label="roundForm.savingAndPublishing" announce={false}><T id="roundForm.saveAndPublish" /></PendingButtonContent></button>}
        </div>
      </form>
      {state.error && <p role="alert"><T id={errors[state.error]} /></p>}
      {creationFinished && state.createdCampaign && <p role="status"><T id={state.createdCampaign.confirmedDraft ? "roundForm.publicationFailedDraft" : "roundForm.publicationUnconfirmed"} /> <Link className="row-action row-action-strong" href={`/campaigns/${state.createdCampaign.id}/edit`}><T id="common.editCampaign" /></Link></p>}
      {state.saved && <p role="status"><T id="roundForm.saved" /></p>}
      {pending && <InlineLoading label="loading.processing" />}
    </div>
    {campaign && <aside className={styles.lifecycle}>
      {readOnly && <p><T id={terminal ? "roundForm.terminal" : "roundForm.errorArchived"} /></p>}
      {campaign?.status === "draft" && !campaign.archived && <form action={action} onSubmit={submit} aria-busy={pending}>
        <p><T id="roundForm.publishHelp" /></p>
        <button className="button button-primary" name="operation" value="publish" disabled={pending}><PendingButtonContent pending={pending} label="loading.processing" announce={false}><T id="campaignForm.publish" /></PendingButtonContent></button>
      </form>}
      {campaign && !terminal && <details>
        <summary className={campaign ? styles.cancel : undefined}><T id={campaign ? "campaignForm.cancelCampaign" : "roundForm.cancel"} /></summary>
        <form action={action} onSubmit={submit} aria-busy={pending}>
          <label className="field"><span><T id="roundForm.reason" /></span><textarea name="reason" rows={3} disabled={pending} /></label>
          <p><T id="roundForm.cancelHelp" /></p>
          <button className={`button button-secondary${campaign ? ` ${styles.cancel}` : ""}`} name="operation" value="cancel" disabled={pending}><PendingButtonContent pending={pending} label="loading.processing" announce={false}><T id={campaign ? "campaignForm.cancelCampaign" : "roundForm.cancel"} /></PendingButtonContent></button>
        </form>
      </details>}
    </aside>}
  </div>;
}
