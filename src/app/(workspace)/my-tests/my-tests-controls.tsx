"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { T, useI18n } from "@/lib/i18n";
import type { MyTestsFilter } from "@/lib/my-tests";

export function MyTestsFilterControl({ filter }: { filter: MyTestsFilter }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <>
    <label className="sr-only" htmlFor="participation-status-filter"><T id="tests.filterStatus" /></label>
    <select id="participation-status-filter" value={filter} disabled={pending} aria-busy={pending} onChange={(event) => {
      const next = event.target.value;
      startTransition(() => router.push(next === "all" ? "/my-tests" : `/my-tests?status=${encodeURIComponent(next)}`, { scroll: false }));
    }}>
      <option value="all"><T id="tests.allStatuses" /></option>
      <option value="progress"><T id="tests.inProgress" /></option>
      <option value="waiting"><T id="dashboard.waitingAccess" /></option>
      <option value="completed"><T id="tests.completedFilter" /></option>
    </select>
  </>;
}

export function MyTestsEndDate({ value }: { value: string | null }) {
  const { language } = useI18n();
  if (value === null) return <>—</>;
  return <time dateTime={value}>{new Intl.DateTimeFormat(language === "es" ? "es-MX" : "en-US", { dateStyle: "medium", timeZone: "America/Cancun" }).format(new Date(value))}</time>;
}
