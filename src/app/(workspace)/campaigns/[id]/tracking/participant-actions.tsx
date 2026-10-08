"use client";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { PendingButtonContent } from "@/components/loading-state";
import { Badge } from "@/components/ui";
import { T, type TranslationKey } from "@/lib/i18n";
import type { ParticipationStatus } from "@/lib/my-tests";
import { enableTrackedAccess, cancelTrackedParticipation, type TrackingMutation } from "./actions";
import styles from "./participant-actions.module.css";

const errorKeys: Record<NonNullable<TrackingMutation["error"]>, TranslationKey> = {
  auth: "tests.errorAuth", unavailable: "tests.errorOwnership", state: "tests.errorState", failed: "tests.errorAction",
};
const statusBadges: Record<ParticipationStatus, "Waiting access" | "Access enabled" | "Active" | "Completed" | "Incompatible" | "Abandoned" | "Cancelled"> = {
  waiting_access: "Waiting access", access_enabled: "Access enabled", active: "Active",
  completed: "Completed", incompatible: "Incompatible", abandoned: "Abandoned", cancelled: "Cancelled",
};
export function ParticipantActions({ campaignId, participationId, displayName, status }: { campaignId: string; participationId: string; displayName: string; status: ParticipationStatus }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<TrackingMutation>({});
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const reasonId = useId();
  const titleId = useId();
  const open = status === "waiting_access" || status === "access_enabled" || status === "active";
  useEffect(() => {
    if (dialogOpen) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [dialogOpen]);
  function run(action: () => Promise<TrackingMutation>, closeOnSuccess = false) {
    if (inFlight.current || pending) return;
    inFlight.current = true;
    setResult({});
    startTransition(async () => {
      try {
        const next = await action();
        setResult(next);
        if (!next.error && closeOnSuccess) { setDialogOpen(false); setReason(""); }
      } catch { setResult({ error: "failed" }); }
      finally { inFlight.current = false; }
    });
  }
  function keepFocusInside(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),textarea:not([disabled])"));
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function closeDialog() {
    if (!inFlight.current && !pending) { setDialogOpen(false); setReason(""); setResult({}); }
  }
  if (!open) return <span className="muted-cell"><T id="tests.readOnly" /></span>;
  return <div aria-busy={pending}>
    <div className="participant-actions">
      {status === "waiting_access" && <button className="row-action row-action-strong" type="button" disabled={pending} onClick={() => run(() => enableTrackedAccess(campaignId, participationId))}><PendingButtonContent pending={pending} label="loading.processing" announce={false}><T id="tracking.enableAccess" /></PendingButtonContent></button>}
      <button className="row-action row-action-muted" type="button" disabled={pending} aria-haspopup="dialog" onClick={() => { if (!inFlight.current && !pending) { setDialogOpen(true); setResult({}); } }}><T id="tracking.cancelParticipation" /></button>
    </div>
    {dialogOpen && <dialog ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={pending}
      onKeyDown={keepFocusInside}
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
      <header className={styles.header}><h2 id={titleId}><T id="tracking.cancelParticipation" /></h2></header>
      <form className={styles.content} onSubmit={(event) => { event.preventDefault(); run(() => cancelTrackedParticipation(campaignId, participationId, reason), true); }}>
        <div className={styles.identity}><strong>{displayName}</strong><Badge status={statusBadges[status]} /></div>
        <p className={styles.confirmation}><T id="tracking.cancelConfirm" values={{ name: displayName }} /></p>
        <label className="field" htmlFor={reasonId}><span><T id="roundForm.reason" /></span></label>
        <textarea id={reasonId} className={styles.reason} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} autoFocus />
        {result.error && <p className={styles.error} role="alert"><T id={errorKeys[result.error]} /></p>}
        <footer className={styles.footer}>
          <button className="button button-secondary" type="button" disabled={pending} onClick={closeDialog}><T id="common.back" /></button>
              <button className={`button ${styles.destructive}`} type="submit" disabled={pending}>
                <PendingButtonContent pending={pending} label="tracking.canceling" announce><T id="tracking.cancelParticipation" /></PendingButtonContent>
          </button>
        </footer>
      </form>
    </dialog>}
    {result.error && !dialogOpen && <p className="muted-cell" role="alert"><T id={errorKeys[result.error]} /></p>}
  </div>;
}
