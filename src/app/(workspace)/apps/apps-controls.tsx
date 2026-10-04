"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { T, useI18n } from "@/lib/i18n";
import type { AppsFilter } from "@/lib/apps";

export function AppsFilterControl({ filter }: { filter: AppsFilter }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <>
    <label className="sr-only" htmlFor="apps-filter"><T id="apps.filter" /></label>
    <select id="apps-filter" value={filter} disabled={pending} onChange={(event) => {
      const next = event.target.value;
      startTransition(() => router.push(next === "all" ? "/apps" : `/apps?status=${encodeURIComponent(next)}`, { scroll: false }));
    }}>
      <option value="all"><T id="apps.all" /></option><option value="active"><T id="apps.active" /></option><option value="archived"><T id="apps.archived" /></option>
    </select>
  </>;
}
export function AppArchivedAt({ value }: { value: string | null }) {
  const { language } = useI18n();
  if (value === null) return null;
  return <small className="muted-cell"><T id="apps.archivedOn" /> <time dateTime={value}>{new Intl.DateTimeFormat(language === "es" ? "es-MX" : "en-US", { dateStyle: "medium", timeZone: "America/Cancun" }).format(new Date(value))}</time></small>;
}
