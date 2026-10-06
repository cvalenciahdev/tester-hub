"use client";
import { useRef, useState, useTransition } from "react";
import { InlineLoading, PendingButtonContent } from "@/components/loading-state";
import { T, type TranslationKey } from "@/lib/i18n";
import type { ParticipationStatus } from "@/lib/my-tests";
import type { ParticipationFeedback } from "@/lib/participation-feedback";
import { ParticipationFeedbackList } from "@/components/participation-feedback-list";
import { addFeedback, updateFeedback, type FeedbackResult } from "./feedback-actions";

const errors: Record<NonNullable<FeedbackResult["error"]>, TranslationKey> = {
  required: "feedback.required", auth: "tests.errorAuth", ownership: "tests.errorOwnership", state: "tests.errorState", missing: "feedback.notAvailable", failed: "tests.errorAction",
};
export function ParticipationFeedbackSection({ participationId, status, feedbacks }: { participationId: string; status: ParticipationStatus; feedbacks: ParticipationFeedback[] }) {
  const [editor, setEditor] = useState<string | "new" | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<FeedbackResult>({});
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const editable = status === "active";
  function open(id: string | "new", value: string) {
    if (!editable || pending || inFlight.current) return;
    setEditor(id); setText(value); setResult({});
  }
  if (!editable && feedbacks.length === 0) return null;
  return <section style={{ marginTop: 14 }} aria-busy={pending}>
    <strong><T id="feedback.title" /></strong>
    {feedbacks.length === 0 ? <ParticipationFeedbackList feedbacks={[]} /> : feedbacks.map((row) => <div key={row.feedback_id}>
      <ParticipationFeedbackList feedbacks={[row]} />
      {editable && <button className="row-action" type="button" disabled={pending} onClick={() => open(row.feedback_id, row.feedback_text)}><T id="feedback.edit" /></button>}
    </div>)}
    {editable && <button className="row-action row-action-strong" type="button" disabled={pending} onClick={() => open("new", "")}><T id="feedback.add" /></button>}
    {editable && editor !== null && <form onSubmit={(event) => {
      event.preventDefault();
      if (inFlight.current || pending) return;
      if (!text.trim()) { setResult({ error: "required" }); return; }
      inFlight.current = true; setResult({});
      startTransition(async () => {
        try {
          const next = editor === "new" ? await addFeedback(participationId, text.trim()) : await updateFeedback(editor, text.trim());
          setResult(next);
          if (!next.error) { setEditor(null); setText(""); }
        } catch { setResult({ error: "failed" }); }
        finally { inFlight.current = false; }
      });
    }}>
      <label className="field"><span><T id="feedback.title" /></span><textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} required disabled={pending} /></label>
      <div className="participation-actions">
        <button className="row-action row-action-strong" type="submit" disabled={pending || !text.trim()}><PendingButtonContent pending={pending} label="tests.saving" announce={false}><T id="feedback.save" /></PendingButtonContent></button>
        <button className="row-action" type="button" disabled={pending} onClick={() => { if (!inFlight.current) { setEditor(null); setResult({}); } }}><T id="tests.cancelAction" /></button>
      </div>
    </form>}
    {pending && <InlineLoading label="tests.saving" />}
    {result.error && <p role="alert"><T id={errors[result.error]} /></p>}
  </section>;
}
