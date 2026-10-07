"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui";
import { ParticipationFeedbackList } from "@/components/participation-feedback-list";
import { T, useI18n } from "@/lib/i18n";
import type { TrackedParticipation } from "@/lib/campaign-tracking";
import { TrackingDate } from "./tracking-date";
import styles from "./participation-detail.module.css";

type Detail = Pick<TrackedParticipation,
  "display_name" | "testing_email_snapshot" | "participation_status" | "joined_at" |
  "access_enabled_at" | "installed_at" | "expected_end_at" | "closed_at" | "close_reason" | "feedbacks"
>;
const statuses = {
  waiting_access: "Waiting access", access_enabled: "Access enabled", active: "Active",
  completed: "Completed", incompatible: "Incompatible", abandoned: "Abandoned", cancelled: "Cancelled",
} as const;

export function ParticipationDetail({ participation }: { participation: Detail }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();
  const feedbacks = [...participation.feedbacks].sort((a, b) =>
    Date.parse(a.created_at) - Date.parse(b.created_at) || a.feedback_id.localeCompare(b.feedback_id),
  );
  const close = () => dialog.current?.close();

  function keepFocusInside(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return <>
    <button className="row-action row-action-strong" type="button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><T id="common.viewDetails" /></button>
    <dialog ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keepFocusInside}>
      <header className={styles.header}>
        <h2 id={titleId}><T id="tracking.participationDetail" /></h2>
        <button className="icon-button" type="button" aria-label={t("tracking.closeDetail")} title={t("tracking.closeDetail")} onClick={close} autoFocus><X size={18} /></button>
      </header>
      <div className={styles.content}>
        <div className={styles.identity}><strong>{participation.display_name?.trim() || "—"}</strong><Badge status={statuses[participation.participation_status]} /></div>
        <p className={styles.email}>{participation.testing_email_snapshot}</p>
        <section className={styles.section}>
          <h3><T id="tracking.dates" /></h3>
          <dl className={styles.dates}>
            <dt><T id="tracking.joined" /></dt><dd><TrackingDate value={participation.joined_at} /></dd>
            <dt><T id="tracking.accessDate" /></dt><dd><TrackingDate value={participation.access_enabled_at} /></dd>
            <dt><T id="tracking.installDate" /></dt><dd><TrackingDate value={participation.installed_at} /></dd>
            <dt><T id="tracking.endDate" /></dt><dd><TrackingDate value={participation.expected_end_at} /></dd>
            <dt><T id="tracking.closeDate" /></dt><dd><TrackingDate value={participation.closed_at} /></dd>
          </dl>
        </section>
        {participation.close_reason?.trim() && <section className={styles.section}>
          <h3><T id="tracking.closeReason" /></h3><p className={styles.reason}>{participation.close_reason}</p>
        </section>}
        <section className={styles.section}>
          <h3><T id="tracking.feedbackHeading" /></h3>
          {feedbacks.length === 0 ? <p className="muted-cell"><T id="tracking.noFeedback" /></p> : <>
            <p className={styles.count}><T id={feedbacks.length === 1 ? "tracking.feedbackCountOne" : "tracking.feedbackCount"} values={{ count: feedbacks.length }} /></p>
            <ParticipationFeedbackList feedbacks={feedbacks} />
          </>}
        </section>
      </div>
      <footer className={styles.footer}><button className="button button-secondary button-small" type="button" onClick={close}><T id="tracking.closeDetail" /></button></footer>
    </dialog>
  </>;
}
