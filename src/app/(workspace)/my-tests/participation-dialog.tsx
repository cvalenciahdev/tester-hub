"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { T, useI18n, type TranslationKey } from "@/lib/i18n";
import styles from "./participation-dialog.module.css";

export function ParticipationDialog({ title, children, onClose, busy = false }: {
  title: TranslationKey; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    return () => node.close();
  }, []);
  function keepFocusInside(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),textarea:not([disabled]),input:not([disabled]),a[href]"));
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <dialog ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} onKeyDown={keepFocusInside}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className={styles.header}><h2 id={titleId}><T id={title} /></h2><button className="icon-button" type="button" aria-label={t("tests.closeDetail")} disabled={busy} onClick={onClose} autoFocus><X size={18} /></button></header>
    <div className={styles.content}>{children}</div>
  </dialog>;
}
