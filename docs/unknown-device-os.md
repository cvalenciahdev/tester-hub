# Unknown device OS version

The schema and existing RPC payload use `user_devices.os_major`, not
`major_version`. They describe the same device OS major-version concept.
`os_minor` and `model` remain in the schema.

`UNKNOWN_OS_MAJOR_VERSION = 24` in `src/lib/device-os.ts` is an internal
sentinel meaning **unknown / not provided**. It does not describe a real
Android or iOS release. Under this contract, a stored device `os_major` of
24 is always unknown, including pre-existing rows; it cannot simultaneously
represent a real release numbered 24. There is no global database default.

- Onboarding asks only for country, testing email, platform and initial intent.
  New/unreported devices use the sentinel, with null minor version and model.
  Existing device metadata is read from the authenticated user's own rows;
  reported versions are preserved, not accepted from removed form fields.
- Profile asks only for platform when editing devices. New devices and
  changes to a different platform use the sentinel; existing IDs survive edits.
  Other profile edits preserve previously reported device metadata.
  Missing/null/blank major version normalizes to the sentinel on the server.
  Invalid explicit versions and the one-to-two/unique-platform rules still fail.
- `knownOsMajorVersion` returns null for the sentinel.
  `formatKnownOsVersion` omits it and any minor version. Never display it as
  version 24, and never compare the raw sentinel to campaign `min_os_major`.
- Unknown version is neither compatible nor incompatible. It must never
  approve/reject automatic compatibility decisions. Current discovery and
  `join_campaign` do not perform OS/device matching and remain unchanged.
  Campaign minimum OS values keep their original semantics: a campaign
  minimum of 24 is not a device sentinel and must not be rewritten or hidden.

The existing RPCs still require a valid integer `os_major`; application
normalization supplies it explicitly. The new migration only documents the
column. No columns, constraints, permissions or historical rows are changed.
Future version capture may replace the sentinel with a real known version,
subject to a future revision of this reserved-value contract.
