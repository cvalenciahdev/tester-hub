export const DURATION_PRESETS = [7, 14, 21, 30, 45, 60, 90] as const;
// Existing storage boundary, not a Google Play policy or a new product maximum.
export const DURATION_INTEGER_MAX = 2147483647;
export function parseDuration(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const days = Number(value);
  return Number.isSafeInteger(days) && days >= 1 && days <= DURATION_INTEGER_MAX ? days : null;
}
export function isDurationPreset(value: string) {
  return DURATION_PRESETS.some((days) => String(days) === value);
}
