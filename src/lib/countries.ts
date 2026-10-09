import catalog from "./countries.json";

// ISO 3166-1 alpha-2 assigned codes, including territories (249 entries).
// Localized names are fixed locally so server/browser Intl versions cannot differ.
export const COUNTRY_CODES = catalog.map((country) => country.code);

const codes = new Set(COUNTRY_CODES);
export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && codes.has(value);
}
export function normalizeCountryCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return isCountryCode(normalized) ? normalized : null;
}

type CountryLanguage = "es" | "en";
const byCode = new Map(catalog.map((country) => [country.code, country]));
export function countryName(code: string | null, language: CountryLanguage): string {
  return isCountryCode(code) ? byCode.get(code)?.names[language] ?? "—" : "—";
}
export function countryOptions(language: CountryLanguage) {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, language) }))
    .sort((a, b) => a.name.localeCompare(b.name, language));
}
export function countrySearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}
