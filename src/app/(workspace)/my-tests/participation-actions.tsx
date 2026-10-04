"use client";

import { useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { T, type TranslationKey } from "@/lib/i18n";
import type { MyParticipation } from "@/lib/my-tests";
import { abandonParticipation, completeParticipation, confirmInstallation, markIncompatible, type MutationResult } from "./actions";

const errorKeys: Record<NonNullable<MutationResult["error"]>, TranslationKey> = {
  INVALID_PARTICIPATION_STATE: "tests.errorState", TEST_PERIOD_NOT_FINISHED: "tests.errorPeriod",
  REASON_REQUIRED: "tests.errorReason", NOT_AUTHENTICATED: "tests.errorAuth",
  NOT_PARTICIPATION_TESTER: "tests.errorOwnership", ACTION_FAILED: "tests.errorAction",
};

export function ParticipationActions({ participation }: { participation: Pick<MyParticipation, "participation_id" | "participation_status" | "can_complete"> }) {
  const [editor, setEditor] = useState<"incompatible" | "abandon" | null>(null);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<MutationResult>({});
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const status = participation.participation_status;
  const isOpen = status === "waiting_access" || status === "access_enabled" || status === "active";

  function run(action: () => Promise<MutationResult>) {
    if (inFlight.current || pending) return;
    inFlight.current = true;
    setResult({});
    startTransition(async () => {
      try {
        const next = await action();
        setResult(next);
        if (!next.error) { setEditor(null); setReason(""); }
      } catch { setResult({ error: "ACTION_FAILED" }); }
      finally { inFlight.current = false; }
    });
  }
  function openEditor(next: "incompatible" | "abandon") {
    if (inFlight.current || pending) return;
    setEditor(next); setReason(""); setResult({});
  }

  if (!isOpen) return <span className="muted-cell"><T id="tests.readOnly" /></span>;
  return (
    <div aria-busy={pending}>
      <div className="participation-actions" style={{ flexWrap: "wrap" }}>
        {status === "access_enabled" && <button className="row-action row-action-strong" type="button" disabled={pending} onClick={() => run(() => confirmInstallation(participation.participation_id))}><Check size={14} /><T id="tests.confirmInstall" /></button>}
        {status === "active" && <button className={`row-action ${participation.can_complete ? "row-action-strong" : ""}`} type="button" disabled={pending || !participation.can_complete} onClick={() => { if (participation.can_complete) run(() => completeParticipation(participation.participation_id)); }}><Check size={14} /><T id="tests.completeTest" /></button>}
        <button className="row-action" type="button" disabled={pending} onClick={() => openEditor("incompatible")}><T id="tests.markIncompatible" /></button>
        <button className="row-action" type="button" disabled={pending} onClick={() => openEditor("abandon")}><T id="tests.abandon" /></button>
      </div>
      {status === "active" && !participation.can_complete && <p className="muted-cell"><T id="tests.periodPending" /></p>}
      {editor && <form onSubmit={(event) => {
        event.preventDefault();
        const trimmed = reason.trim();
        if (editor === "incompatible" && !trimmed) { setResult({ error: "REASON_REQUIRED" }); return; }
        run(() => editor === "incompatible" ? markIncompatible(participation.participation_id, trimmed) : abandonParticipation(participation.participation_id, trimmed || null));
      }}>
        <label className="field">
          <span><T id={editor === "incompatible" ? "tests.requiredReason" : "tests.optionalReason"} /></span>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} required={editor === "incompatible"} disabled={pending} autoFocus />
        </label>
        <div className="participation-actions">
          <button className="row-action row-action-strong" type="submit" disabled={pending || (editor === "incompatible" && !reason.trim())}><T id="tests.confirmAction" /></button>
          <button className="row-action" type="button" disabled={pending} onClick={() => { setEditor(null); setResult({}); }}><T id="tests.cancelAction" /></button>
        </div>
      </form>}
      {pending && <p className="muted-cell" role="status"><T id="tests.saving" /></p>}
      {result.error && <p className="muted-cell" role="alert"><T id={errorKeys[result.error]} /></p>}
    </div>
  );
}
