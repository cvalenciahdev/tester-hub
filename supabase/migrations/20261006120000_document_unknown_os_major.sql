-- Technical contract only: no default, constraint, data, RPC or RLS changes.
-- UNKNOWN_OS_MAJOR_VERSION is centralized in src/lib/device-os.ts.
comment on column public.user_devices.os_major is
  'OS major version. Internal sentinel 24 means unknown / not reported, NOT a real OS version. Never display 24 as a version, compare it as a real version, or use it to approve/reject compatibility. Onboarding/Profile assign it explicitly when unreported; a real reported version may replace it in a future flow.';
