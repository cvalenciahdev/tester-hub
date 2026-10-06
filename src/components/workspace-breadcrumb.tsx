"use client";

import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import styles from "./workspace-breadcrumb.module.css";

type BreadcrumbItem = ({ label: string; translationKey?: never } | { translationKey: TranslationKey; label?: never }) & { href?: string };
type Breadcrumb = { pathname: string; items: BreadcrumbItem[] };
const BreadcrumbContext = createContext<{
  breadcrumb: Breadcrumb | null;
  setBreadcrumb: Dispatch<SetStateAction<Breadcrumb | null>>;
} | null>(null);

function useBreadcrumb() {
  const context = useContext(BreadcrumbContext);
  if (!context) throw new Error("Workspace breadcrumb provider is required.");
  return context;
}

export function WorkspaceBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [breadcrumb, setBreadcrumb] = useState<Breadcrumb | null>(null);
  const value = useMemo(() => ({ breadcrumb, setBreadcrumb }), [breadcrumb]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function SetWorkspaceBreadcrumb({ pathname, items }: Breadcrumb) {
  const { setBreadcrumb } = useBreadcrumb();
  useEffect(() => {
    const breadcrumb = { pathname, items };
    setBreadcrumb(breadcrumb);
    return () => setBreadcrumb((current) => current === breadcrumb ? null : current);
  }, [pathname, items, setBreadcrumb]);
  return null;
}

export function WorkspaceBreadcrumb({ fallbackTitle }: { fallbackTitle: string }) {
  const { breadcrumb } = useBreadcrumb();
  const pathname = usePathname();
  const { t } = useI18n();
  if (!breadcrumb || breadcrumb.pathname !== pathname) {
    return <div className="breadcrumbs"><span>{t("shell.breadcrumbWorkspace")}</span><span className="crumb-separator">/</span><strong>{fallbackTitle}</strong></div>;
  }
  return (
    <nav className={`breadcrumbs ${styles.contextual}`} aria-label={t("shell.breadcrumbLabel")}>
      <div className={styles.part}><span className={styles.label}>{t("shell.breadcrumbWorkspace")}</span></div>
      {breadcrumb.items.map((item, index) => {
        const label = item.translationKey ? t(item.translationKey) : item.label;
        const current = index === breadcrumb.items.length - 1;
        return <div className={styles.part} key={`${index}-${item.href ?? "current"}`}>
          <span className={styles.separator} aria-hidden="true">/</span>
          {current ? <strong className={styles.label} aria-current="page" title={label}>{label}</strong> :
            <Link className={styles.label} href={item.href ?? pathname} title={label}>{label}</Link>}
        </div>;
      })}
    </nav>
  );
}
