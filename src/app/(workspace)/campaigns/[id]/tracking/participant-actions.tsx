"use client";
import { useRef, useState, useTransition } from "react";
import { InlineLoading, PendingButtonContent } from "@/components/loading-state";
import { T, type TranslationKey } from "@/lib/i18n";
import type { ParticipationStatus } from "@/lib/my-tests";
import { enableTrackedAccess, cancelTrackedParticipation, type TrackingMutation } from "./actions";

const errorKeys: Record<NonNullable<TrackingMutation["error"]>, TranslationKey> = {
  auth: "tests.errorAuth", unavailable: "tests.errorOwnership", state: "tests.errorState", failed: "tests.errorAction",
};
export function ParticipantActions({ campaignId, participationId, status }: { campaignId: string; participationId: string; status: ParticipationStatus }) {
  const [editor, setEditor] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<TrackingMutation>({});
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const open = status === "waiting_access" || status === "access_enabled" || status === "active";
  function run(action: () => Promise<TrackingMutation>) {
    if (inFlight.current || pending) return;
    inFlight.current = true;
    setResult({});
    startTransition(async () => {
      try {
        const next = await action();
        setResult(next);
        if (!next.error) { setEditor(false); setReason(""); }
      } catch { setResult({ error: "failed" }); }
      finally { inFlight.current = false; }
    });
  }
  if (!open) return <span className="muted-cell"><T id="tests.readOnly" /></span>;
  return <div aria-busy={pending}>
    <div className="participant-actions">
      {status === "waiting_access" && <button className="row-action row-action-strong" type="button" disabled={pending} onClick={() => run(() => enableTrackedAccess(campaignId, participationId))}><PendingButtonContent pending={pending} label="loading.processing" announce={false}><T id="tracking.enableAccess" /></PendingButtonContent></button>}
      <button className="row-action row-action-muted" type="button" disabled={pending} onClick={() => { if (!inFlight.current && !pending) { setEditor(true); setResult({}); } }}><T id="tracking.cancelParticipation" /></button>
    </div>
    {editor && <form onSubmit={(event) => { event.preventDefault(); run(() => cancelTrackedParticipation(campaignId, participationId, reason)); }}>
      <label className="field"><span><T id="roundForm.reason" /></span><textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} /></label>
      <div className="participant-actions">
        <button className="row-action row-action-strong" type="submit" disabled={pending}><PendingButtonContent pending={pending} label="loading.processing" announce={false}><T id="tracking.cancelParticipation" /></PendingButtonContent></button>
        <button className="row-action" type="button" disabled={pending} onClick={() => { if (!inFlight.current) { setEditor(false); setReason(""); } }}><T id="common.cancel" /></button>
      </div>
    </form>}
    {pending && <InlineLoading label="loading.processing" />}
    {result.error && <p className="muted-cell" role="alert"><T id={errorKeys[result.error]} /></p>}
  </div>;
}
