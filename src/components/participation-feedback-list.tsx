"use client";
import { T, useI18n } from "@/lib/i18n";
import type { ParticipationFeedback } from "@/lib/participation-feedback";

export function ParticipationFeedbackList({ feedbacks }: { feedbacks: ParticipationFeedback[] }) {
  const { language } = useI18n();
  const date = (value: string) => new Intl.DateTimeFormat(language === "es" ? "es-MX" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Cancun" }).format(new Date(value));
  if (feedbacks.length === 0) return <p className="muted-cell"><T id="feedback.empty" /></p>;
  return <div>{feedbacks.map((row) => <article key={row.feedback_id} style={{ marginTop: 10 }}>
    <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{row.feedback_text}</p>
    <small className="muted-cell"><T id="feedback.created" /> <time dateTime={row.created_at}>{date(row.created_at)}</time>{row.updated_at !== row.created_at && <> · <T id="feedback.updated" /> <time dateTime={row.updated_at}>{date(row.updated_at)}</time></>}</small>
  </article>)}</div>;
}
