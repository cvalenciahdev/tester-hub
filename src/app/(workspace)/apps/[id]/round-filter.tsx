"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/i18n";
import type { RoundFilter } from "@/lib/app-rounds";

export function RoundFilterControl({ appId, filter }: { appId: string; filter: RoundFilter }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <>
    <label className="sr-only" htmlFor="app-round-status-filter"><T id="campaigns.filter" /></label>
    <select id="app-round-status-filter" value={filter} disabled={pending} aria-busy={pending} onChange={(event) => {
      const status = event.target.value;
      startTransition(() => router.push(`/apps/${appId}/campaigns${status === "all" ? "" : `?round_status=${encodeURIComponent(status)}`}`, { scroll: false }));
    }}>
      <option value="all"><T id="campaigns.allStatuses" /></option>
      <option value="draft"><T id="status.Draft" /></option>
      <option value="recruiting"><T id="status.Recruiting" /></option>
      <option value="testing"><T id="status.Testing" /></option>
      <option value="completed"><T id="status.Completed" /></option>
      <option value="cancelled"><T id="status.Cancelled" /></option>
    </select>
  </>;
}
