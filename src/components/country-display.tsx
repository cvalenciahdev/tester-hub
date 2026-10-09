"use client";

import { countryName } from "@/lib/countries";
import { useI18n } from "@/lib/i18n";

export function CountryName({ code }: { code: string | null }) {
  const { language } = useI18n();
  return countryName(code, language);
}

export function CountryAvailability({ all, codes }: { all: boolean; codes: string[] }) {
  const { language, t } = useI18n();
  if (all) return t("dashboard.allCountries");
  const unique = [...new Set(codes)];
  return unique.length > 3 ? t("countries.count", { count: unique.length })
    : unique.map((code) => countryName(code, language)).join(", ") || "—";
}
