"use client";

import { useEffect } from "react";
import { EmptyHint } from "@/components/ui";
import { T, useI18n } from "@/lib/i18n";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("Dashboard data failed to load.", error);
  }, [error]);

  return (
    <section className="panel">
      <EmptyHint><T id="dashboard.loadError" /></EmptyHint>
      <button className="button button-secondary button-small" onClick={reset} type="button">
        {t("dashboard.retry")}
      </button>
    </section>
  );
}
