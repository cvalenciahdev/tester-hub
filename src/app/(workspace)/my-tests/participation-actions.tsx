"use client";

import { useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { InlineLoading, PendingButtonContent } from "@/components/loading-state";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui";
import { T, useI18n, type TranslationKey } from "@/lib/i18n";
import type { MyParticipation } from "@/lib/my-tests";
import { abandonParticipation, completeParticipation, confirmInstallation, markIncompatible, type MutationResult } from "./actions";
import { ParticipationDialog } from "./participation-dialog";
import { ParticipationFeedbackEditor, ParticipationFeedbackSection } from "./participation-feedback";
import { MyTestsEndDate } from "./my-tests-controls";
import styles from "./participation-dialog.module.css";

const errorKeys: Record<NonNullable<MutationResult["error"]>, TranslationKey> = {
  INVALID_PARTICIPATION_STATE: "tests.errorState", TEST_PERIOD_NOT_FINISHED: "tests.errorPeriod",
  REASON_REQUIRED: "tests.errorReason", NOT_AUTHENTICATED: "tests.errorAuth",
  NOT_PARTICIPATION_TESTER: "tests.errorOwnership", ACTION_FAILED: "tests.errorAction",
  FEEDBACK_REQUIRED: "feedback.beforeComplete",
};
const statuses = { waiting_access: "Waiting access", access_enabled: "Access enabled", active: "Active", completed: "Completed", incompatible: "Incompatible", abandoned: "Abandoned", cancelled: "Cancelled" } as const;
type View = "detail" | "feedback" | "incompatible" | "abandon" | "install" | "complete" | null;
const titles = { incompatible: "tests.markIncompatible", abandon: "tests.abandon", install: "tests.confirmInstall", complete: "tests.completeTest" } as const;

export function ParticipationActions({ participation }: { participation: MyParticipation }) {
  const [view, setView] = useState<View>(null);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<MutationResult>({});
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const detailButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const inFlight = useRef(false);
  const { t } = useI18n();
  const status = participation.participation_status;
  const isOpen = status === "waiting_access" || status === "access_enabled" || status === "active";
  const hasFeedback = participation.feedbacks.length > 0;

  function close() {
    if (pending || inFlight.current) return;
    const opener = view === "detail" ? detailButton : menuButton;
    setView(null); setResult({});
    requestAnimationFrame(() => opener.current?.focus());
  }
  function open(next: Exclude<View, null>) {
    if (pending || inFlight.current) return;
    menu.current?.hidePopover(); setView(next); setReason(""); setResult({});
  }
  function run(action: () => Promise<MutationResult>) {
    if (inFlight.current || pending) return;
    inFlight.current = true; setResult({});
    startTransition(async () => {
      try {
        const next = await action(); setResult(next);
        if (!next.error) { setView(null); setReason(""); requestAnimationFrame(() => menuButton.current?.focus()); }
      } catch { setResult({ error: "ACTION_FAILED" }); }
      finally { inFlight.current = false; }
    });
  }
  function showMenu(last = false) {
    const node = menu.current, button = menuButton.current;
    if (!node || !button || pending) return;
    node.showPopover();
    const rect = button.getBoundingClientRect();
    node.style.left = `${Math.max(12, Math.min(rect.right - node.offsetWidth, window.innerWidth - node.offsetWidth - 12))}px`;
    node.style.top = `${Math.max(12, Math.min(rect.bottom + 5, window.innerHeight - node.offsetHeight - 12))}px`;
    const items = node.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])');
    items[last ? items.length - 1 : 0]?.focus();
  }
  function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
    if (event.key === "Escape") { event.preventDefault(); menu.current?.hidePopover(); menuButton.current?.focus(); }
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault(); const index = items.indexOf(document.activeElement as HTMLElement);
      items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") menu.current?.hidePopover();
  }
  return <div className={styles.rowActions}>
    <button ref={detailButton} className="row-action row-action-strong" type="button" onClick={() => open("detail")}><T id="common.viewDetails" /></button>
    {isOpen && <>
      <button ref={menuButton} className="icon-button" type="button" aria-label={t("tests.actionsMenu")} aria-haspopup="menu" aria-controls={menuId} aria-expanded={menuOpen} disabled={pending} onClick={() => { if (menuOpen) menu.current?.hidePopover(); else showMenu(); }} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); showMenu(event.key === "ArrowUp"); } }}><MoreHorizontal size={18} /></button>
      <div ref={menu} id={menuId} popover="auto" role="menu" aria-label={t("tests.actionsMenu")} className={styles.menu} onKeyDown={menuKeys} onToggle={() => setMenuOpen(menu.current?.matches(":popover-open") ?? false)}>
        {(status === "access_enabled" || status === "active") && participation.store_url && <a role="menuitem" tabIndex={-1} href={participation.store_url} target="_blank" rel="noopener noreferrer" onClick={() => menu.current?.hidePopover()}><T id="tests.openInstallation" /></a>}
        {status === "access_enabled" && <button role="menuitem" tabIndex={-1} type="button" onClick={() => { open("install"); run(() => confirmInstallation(participation.participation_id)); }}><T id="tests.confirmInstall" /></button>}
        {status === "active" && <>
          <button role="menuitem" tabIndex={-1} type="button" onClick={() => open("feedback")}><T id="feedback.add" /></button>
          <button role="menuitem" tabIndex={-1} type="button" disabled={!participation.can_complete || !hasFeedback} title={!participation.can_complete ? t("tests.periodPending") : !hasFeedback ? t("feedback.beforeComplete") : undefined} onClick={() => { if (participation.can_complete && hasFeedback) { open("complete"); run(() => completeParticipation(participation.participation_id)); } }}><T id="tests.completeTest" /></button>
        </>}
        <button role="menuitem" tabIndex={-1} type="button" onClick={() => open("incompatible")}><T id="tests.markIncompatible" /></button>
        <button role="menuitem" tabIndex={-1} type="button" onClick={() => open("abandon")}><T id="tests.abandon" /></button>
      </div>
    </>}
    {view === "detail" && <ParticipationDialog title="tests.detailTitle" onClose={close}>
      <div className={styles.identity}><strong>{participation.app_name}</strong><Badge status={statuses[status]} /></div>
      <p className="muted-cell">{participation.platform === "android" ? "Android" : "iOS"}</p>
      <section className={styles.section}><h3><T id="tests.period" /></h3><dl className={styles.dates}>
        <dt><T id="tracking.installDate" /></dt><dd><MyTestsEndDate value={participation.installed_at} /></dd>
        <dt><T id="tests.ending" /></dt><dd><MyTestsEndDate value={participation.expected_end_at} /></dd>
        <dt><T id="tracking.closeDate" /></dt><dd><MyTestsEndDate value={participation.closed_at} /></dd>
      </dl></section>
      {participation.close_reason?.trim() && <section className={styles.section}><h3><T id="tracking.closeReason" /></h3><p className={styles.reason}>{participation.close_reason}</p></section>}
      <ParticipationFeedbackSection participationId={participation.participation_id} status={status} feedbacks={participation.feedbacks} />
      <div className={styles.footer}><button className="button button-secondary button-small" type="button" onClick={close}><T id="tests.closeDetail" /></button></div>
    </ParticipationDialog>}
    {view === "feedback" && <ParticipationFeedbackEditor participationId={participation.participation_id} status={status} onClose={close} />}
    {view !== null && view !== "detail" && view !== "feedback" && <ParticipationDialog title={titles[view]} busy={pending} onClose={close}>
      {(view === "incompatible" || view === "abandon") && <form onSubmit={(event) => {
        event.preventDefault(); const trimmed = reason.trim();
        if (view === "incompatible" && !trimmed) { setResult({ error: "REASON_REQUIRED" }); return; }
        run(() => view === "incompatible" ? markIncompatible(participation.participation_id, trimmed) : abandonParticipation(participation.participation_id, trimmed || null));
      }}>
        <label className="field"><span><T id={view === "incompatible" ? "tests.requiredReason" : "tests.optionalReason"} /></span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required={view === "incompatible"} disabled={pending} /></label>
        <div className={styles.footer}><button className="button button-secondary button-small" type="button" disabled={pending} onClick={close}><T id="tests.cancelAction" /></button><button className="button button-primary button-small" type="submit" disabled={pending || (view === "incompatible" && !reason.trim())}><PendingButtonContent pending={pending} label="tests.saving" announce={false}><T id="tests.confirmAction" /></PendingButtonContent></button></div>
      </form>}
      {pending && view !== "incompatible" && view !== "abandon" && <InlineLoading label="tests.saving" />}
      {result.error && <p role="alert"><T id={errorKeys[result.error]} /></p>}
      {!pending && (view === "install" || view === "complete") && <div className={styles.footer}><button className="button button-secondary button-small" type="button" onClick={close}><T id="tests.closeDetail" /></button></div>}
    </ParticipationDialog>}
  </div>;
}
