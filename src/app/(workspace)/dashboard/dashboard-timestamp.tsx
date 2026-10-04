"use client";

import { useI18n } from "@/lib/i18n";

export function DashboardTimestamp({
  value,
  dateOnly = false,
}: {
  value: string;
  dateOnly?: boolean;
}) {
  const { language } = useI18n();
  const date = new Date(value);
  const locale = language === "es" ? "es-ES" : "en-US";
  const formatted = date.toLocaleString(
    locale,
    dateOnly
      ? { dateStyle: "medium" }
      : { dateStyle: "medium", timeStyle: "short" },
  );

  return <time dateTime={value}>{formatted}</time>;
}

export function DashboardGreeting({ name }: { name: string | null }) {
  const { t } = useI18n();

  return t("dashboard.greeting", {
    name: name?.trim() || t("dashboard.greetingFallback"),
  });
}
