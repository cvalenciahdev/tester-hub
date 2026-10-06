import type { ReactNode } from "react";
import { T, type TranslationKey } from "@/lib/i18n";
import styles from "./loading-state.module.css";

export function Spinner({ size = "medium", inheritColor = false }: { size?: "small" | "medium"; inheritColor?: boolean }) {
  return <span className={`${styles.spinner} ${size === "small" ? styles.small : styles.medium}${inheritColor ? ` ${styles.inherit}` : ""}`} aria-hidden="true" />;
}

export function LoadingState({ label, variant = "page" }: { label: TranslationKey; variant?: "page" | "section" }) {
  return <div className={variant === "page" ? styles.page : styles.section} role="status" aria-live="polite" aria-busy="true">
    <div className={variant === "page" ? styles.card : styles.sectionContent}>
      <Spinner />
      <p className={styles.title}><T id={label} /></p>
      {variant === "page" && <p className={styles.subtitle}><T id="loading.moment" /></p>}
    </div>
  </div>;
}

export function InlineLoading({ label }: { label: TranslationKey }) {
  return <span className={styles.inline} role="status" aria-live="polite"><Spinner size="small" /><T id={label} /></span>;
}

export function PendingButtonContent({ pending, label = "apps.saving", announce = true, children }: { pending: boolean; label?: TranslationKey; announce?: boolean; children: ReactNode }) {
  return <span className={styles.buttonContent}>
    <span className={pending ? styles.hidden : undefined} aria-hidden={pending || undefined}>{children}</span>
    <span className={pending ? undefined : styles.hidden} aria-hidden={!pending || undefined} role={pending && announce ? "status" : undefined} aria-live={pending && announce ? "polite" : undefined}>
      <Spinner size="small" inheritColor /><T id={label} />
    </span>
  </span>;
}
