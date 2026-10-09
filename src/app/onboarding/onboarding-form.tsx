"use client";

import { useActionState, useState } from "react";
import { PendingButtonContent } from "@/components/loading-state";
import { CountrySelect } from "@/components/country-select";
import { ArrowRight } from "lucide-react";
import { completeOnboarding, type OnboardingFormState } from "@/app/onboarding/actions";
import { T, useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import type { OnboardingProfile } from "@/lib/auth";

type ExistingDevice = { platform: "android" | "ios" };

const initialState: OnboardingFormState = {};
const intentOptions: {
  value: "tester" | "developer" | "both";
  label: TranslationKey;
  description: TranslationKey;
}[] = [
  { value: "tester", label: "onboarding.tryApps", description: "onboarding.tryAppsDescription" },
  { value: "developer", label: "onboarding.findTesters", description: "onboarding.findTestersDescription" },
  { value: "both", label: "onboarding.both", description: "onboarding.bothDescription" },
];

export function OnboardingForm({
  profile,
  devices,
}: {
  profile: OnboardingProfile | null;
  devices: ExistingDevice[];
}) {
  const [state, action, pending] = useActionState(completeOnboarding, initialState);
  const { t } = useI18n();
  const [country, setCountry] = useState(profile?.country_code ?? "");
  const hasAndroid = devices.some((device) => device.platform === "android");
  const hasIos = devices.some((device) => device.platform === "ios");
  const [platform, setPlatform] = useState(
    hasAndroid && hasIos ? "both" : hasIos ? "ios" : hasAndroid ? "android" : "",
  );

  return (
    <form action={action}>
      <div className="form-grid">
        <CountrySelect name="country_code" label={t("onboarding.country")} value={country} onChange={setCountry} required disabled={pending} />
        <label className="field">
          <span><T id="onboarding.testingEmail" /> <b>*</b></span>
          <input
            autoComplete="email"
            defaultValue={profile?.testing_email ?? ""}
            name="testing_email"
            placeholder={t("onboarding.testingEmailPlaceholder")}
            required
            type="email"
          />
          <small><T id="onboarding.testingEmailHelp" /></small>
        </label>
      </div>

      <label className="field onboarding-platform-field">
        <span><T id="onboarding.mainPlatform" /> <b>*</b></span>
        <select onChange={(event) => setPlatform(event.target.value)} required value={platform} name="platform">
          <option value="" disabled><T id="onboarding.selectPlatform" /></option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
          <option value="both"><T id="onboarding.both" /></option>
        </select>
      </label>


      <fieldset className="intent-options">
        <legend><T id="onboarding.intentQuestion" /></legend>
        {intentOptions.map(({ value, label, description }, index) => (
          <label key={value}>
            <input
              defaultChecked={profile?.initial_intent ? profile.initial_intent === value : index === 0}
              name="initial_intent"
              required={index === 0}
              type="radio"
              value={value}
            />
            <span>
              <strong><T id={label} /></strong>
              <small><T id={description} /></small>
            </span>
          </label>
        ))}
      </fieldset>

      {state.error && (
        <p className="auth-error" role="alert">
          <T id={`onboarding.error.${state.error}`} />
        </p>
      )}

      <div className="form-actions">
        <button className="button button-primary" disabled={pending} type="submit">
          <PendingButtonContent pending={pending} label="onboarding.saving">{t("onboarding.continue")}<ArrowRight size={16} /></PendingButtonContent>
        </button>
      </div>
    </form>
  );
}
