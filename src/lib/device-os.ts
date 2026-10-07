/**
 * Internal sentinel for an unknown / unreported OS major version.
 * 24 is NOT an actual OS version: never display or compare it as one,
 * and never use it to approve or reject campaign compatibility.
 * A real reported version may replace this sentinel in a future flow.
 * The database/RPC field is os_major (conceptually major_version).
 */
export const UNKNOWN_OS_MAJOR_VERSION = 24;

export function knownOsMajorVersion(osMajor: number): number | null {
  return osMajor === UNKNOWN_OS_MAJOR_VERSION ? null : osMajor;
}

export function formatKnownOsVersion(osMajor: number, osMinor: number | null): string | null {
  const major = knownOsMajorVersion(osMajor);
  return major === null ? null : `${major}${osMinor === null ? "" : `.${osMinor}`}`;
}

export function unknownDevice(platform: "android" | "ios"): {
  platform: "android" | "ios"; os_major: number; os_minor: number | null; model: string | null;
} {
  return { platform, os_major: UNKNOWN_OS_MAJOR_VERSION, os_minor: null, model: null };
}
