"use client";
import { useI18n } from "@/lib/i18n";
export function TrackingDate({ value }: { value: string | null }) {
  const { language } = useI18n();
  if (value === null) return <>—</>;
  return <time dateTime={value}>{new Intl.DateTimeFormat(language === "es" ? "es-MX" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Cancun" }).format(new Date(value))}</time>;
}
