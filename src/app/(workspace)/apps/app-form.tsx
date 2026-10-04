"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { T, type TranslationKey } from "@/lib/i18n";
import type { OwnApp } from "@/lib/apps";
import { createApp, updateApp, type AppMutationResult } from "./actions";

const errors: Record<NonNullable<AppMutationResult["error"]>, TranslationKey> = {
  nameRequired: "apps.nameRequired", notAuthenticated: "apps.errorAuth", unavailable: "apps.notAvailable", saveFailed: "apps.saveFailed",
};
export function AppForm({ app }: { app?: OwnApp }) {
  const inFlight = useRef(false);
  const [state, action, pending] = useActionState<AppMutationResult, FormData>(async (_previous, formData) => {
    try { return app ? await updateApp(app.id, formData) : await createApp(formData); }
    finally { inFlight.current = false; }
  }, {});
  const readOnly = app?.archived_at !== null && app?.archived_at !== undefined;
  return (
    <form className="panel campaign-form" action={action} aria-busy={pending} onSubmit={(event) => {
      if (pending || inFlight.current || readOnly) event.preventDefault();
      else inFlight.current = true;
    }}>
      <section className="form-section">
        <div className="form-section-heading"><div><h2><T id={app ? "apps.editApp" : "apps.newApp"} /></h2></div></div>
        <div className="form-grid">
          <label className="field field-full"><span><T id="apps.nameLabel" /> <b>*</b></span><input name="name" defaultValue={app?.name ?? ""} required disabled={pending || readOnly} /></label>
          <label className="field field-full"><span><T id="apps.descriptionLabel" /></span><textarea name="description" rows={4} defaultValue={app?.description ?? ""} disabled={pending || readOnly} /></label>
        </div>
        {readOnly && <p className="muted-cell"><T id="apps.archivedReadOnly" /></p>}
        {state.error && <p className="muted-cell" role="alert"><T id={errors[state.error]} /></p>}
        {state.saved && <p className="muted-cell" role="status"><T id="apps.saved" /></p>}
        {pending && <p className="muted-cell" role="status"><T id="apps.saving" /></p>}
      </section>
      <div className="form-actions">
        <Link className="button button-quiet" href="/apps"><T id="apps.back" /></Link>
        {!readOnly && <button className="button button-primary" type="submit" disabled={pending}><T id={app ? "apps.saveChanges" : "apps.createApp"} /></button>}
      </div>
    </form>
  );
}
