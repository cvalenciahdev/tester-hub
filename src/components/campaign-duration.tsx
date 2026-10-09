"use client";
import { useEffect, useId, useRef, useState } from "react";
import { DURATION_PRESETS, DURATION_INTEGER_MAX, isDurationPreset, parseDuration } from "@/lib/campaign-duration";
import { T, useI18n } from "@/lib/i18n";

export function CampaignDuration({ platform, value, onChange, disabled = false, locked = false }: {
  platform: string; value: string; onChange: (value: string) => void; disabled?: boolean; locked?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const select = useRef<HTMLSelectElement>(null);
  const [custom, setCustom] = useState(!isDurationPreset(value));
  const android = platform === "android";
  const customActive = android && (custom || !isDurationPreset(value));
  const days = parseDuration(value);
  const iosExceeded = !android && days !== null && days > 90;
  const invalid = days === null || iosExceeded;
  const selected = customActive ? "custom" : value;
  const currentOption = !android && !isDurationPreset(value);
  useEffect(() => {
    select.current?.setCustomValidity(!android && invalid && !disabled ? t(iosExceeded ? "duration.iosExceeded" : "duration.invalid") : "");
  }, [android, invalid, disabled, iosExceeded, t]);
  return <div className="field">
    <label htmlFor={`${id}-select`}><T id="common.duration" /> (<T id="campaignForm.days" />)</label>
    <select ref={select} id={`${id}-select`} name={customActive ? undefined : "duration_days"} value={selected}
      required disabled={disabled} aria-invalid={invalid} aria-describedby={`${id}-help`}
      onChange={(event) => {
        if (event.target.value === "custom") setCustom(true);
        else { setCustom(false); onChange(event.target.value); }
      }}>
      {DURATION_PRESETS.map((duration) => <option key={duration} value={duration}>{t("duration.option", { count: duration })}</option>)}
      {android && <option value="custom">{t("duration.custom")}</option>}
      {currentOption && <option value={value} disabled={invalid}>{t(invalid ? "duration.invalidCurrent" : "duration.current", { count: value })}</option>}
    </select>
    {customActive && <>
      <label htmlFor={`${id}-custom`}><T id="duration.customDays" /></label>
      <input id={`${id}-custom`} name="duration_days" type="number" min={1} max={DURATION_INTEGER_MAX} step={1}
        required value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}
        aria-invalid={invalid} aria-describedby={`${id}-help`} />
    </>}
    <small id={`${id}-help`}>{android ? <T id="duration.androidHelp" /> : <T id="duration.iosHelp" />}</small>
    {invalid && <small role="alert"><T id={iosExceeded ? locked ? "duration.iosLocked" : "duration.iosExceeded" : "duration.invalid"} /></small>}
  </div>;
}
