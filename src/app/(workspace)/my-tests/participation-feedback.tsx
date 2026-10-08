"use client";
import { useRef, useState, useTransition } from "react";
import { PendingButtonContent } from "@/components/loading-state";
import { T, type TranslationKey } from "@/lib/i18n";
import type { ParticipationStatus } from "@/lib/my-tests";
import type { ParticipationFeedback } from "@/lib/participation-feedback";
import { ParticipationFeedbackList } from "@/components/participation-feedback-list";
import { addFeedback, updateFeedback, type FeedbackResult } from "./feedback-actions";
import { ParticipationDialog } from "./participation-dialog";
import styles from "./participation-dialog.module.css";

const errors: Record<NonNullable<FeedbackResult["error"]>, TranslationKey> = {
  required: "feedback.required", auth: "tests.errorAuth", ownership: "tests.errorOwnership", state: "tests.errorState", missing: "feedback.notAvailable", failed: "tests.errorAction",
};
export function ParticipationFeedbackSection({ participationId, status, feedbacks }: { participationId: string; status: ParticipationStatus; feedbacks: ParticipationFeedback[] }) {
  const [editor, setEditor] = useState<ParticipationFeedback | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const sorted = [...feedbacks].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.feedback_id.localeCompare(b.feedback_id));
  return <section className={styles.section}>
    <h3><T id="tests.detailFeedback" /></h3>
    {sorted.length === 0 ? <p className="muted-cell"><T id="tests.noFeedback" /></p> : sorted.map((row) => <div key={row.feedback_id}>
      <ParticipationFeedbackList feedbacks={[row]} />
      {status === "active" && <button className="row-action" type="button" onClick={(event) => { opener.current = event.currentTarget; setEditor(row); }}><T id="feedback.edit" /></button>}
    </div>)}
    {editor && status === "active" && <ParticipationFeedbackEditor participationId={participationId} status={status} feedback={editor} onClose={() => { setEditor(null); requestAnimationFrame(() => opener.current?.focus()); }} />}
  </section>;
}

export function ParticipationFeedbackEditor({ participationId, status, feedback, onClose }: { participationId: string; status: ParticipationStatus; feedback?: ParticipationFeedback; onClose: () => void }) {
  const [text, setText] = useState(feedback?.feedback_text ?? "");
  const [result, setResult] = useState<FeedbackResult>({});
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  if (status !== "active") return null;
  return <ParticipationDialog title={feedback ? "feedback.edit" : "feedback.add"} busy={pending} onClose={() => { if (!inFlight.current) onClose(); }}>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (inFlight.current || pending) return;
      if (!text.trim()) { setResult({ error: "required" }); return; }
      inFlight.current = true; setResult({});
      startTransition(async () => {
        try {
          const next = feedback ? await updateFeedback(feedback.feedback_id, text.trim()) : await addFeedback(participationId, text.trim());
          setResult(next);
          if (!next.error) onClose();
        } catch { setResult({ error: "failed" }); }
        finally { inFlight.current = false; }
      });
    }}>
      <label className="field"><span><T id="feedback.title" /></span><textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} required disabled={pending} /></label>
      <div className={styles.footer}>
        <button className="button button-secondary button-small" type="button" disabled={pending} onClick={() => { if (!inFlight.current) onClose(); }}><T id="tests.cancelAction" /></button>
        <button className="button button-primary button-small" type="submit" disabled={pending || !text.trim()}><PendingButtonContent pending={pending} label="tests.saving" announce={false}><T id="feedback.save" /></PendingButtonContent></button>
      </div>
    </form>
    {result.error && <p role="alert"><T id={errors[result.error]} /></p>}
  </ParticipationDialog>;
}
