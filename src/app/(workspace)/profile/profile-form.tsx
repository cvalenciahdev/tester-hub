"use client";
import { useActionState, useRef, useState } from "react";
import { LockKeyhole, Mail, Smartphone } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { CurrentLanguageName, T, type TranslationKey, useI18n } from "@/lib/i18n";
import type { ProfileData } from "@/lib/profile";
import type { ProfileError, ProfileResult } from "@/lib/profile-input";
import { updateMyProfile } from "./actions";

type DeviceDraft = { key: string; id?: string; platform: "android" | "ios"; major: string; minor: string; model: string };
const errors: Record<ProfileError, TranslationKey> = {
  country: "onboarding.error.invalidCountry", email: "onboarding.error.invalidEmail", intent: "onboarding.error.invalidIntent",
  devices: "profile.errorDevices", device: "profile.errorDevice", ownership: "profile.errorOwnership",
  auth: "tests.errorAuth", missing: "profile.errorMissing", failed: "profile.errorSave",
};
const intents = { tester: "onboarding.tryApps", developer: "onboarding.findTesters", both: "onboarding.both" } as const;
export function ProfileForm({ data }: { data: ProfileData }) {
  const { language } = useI18n();
  const inFlight = useRef(false), newDevice = useRef(0);
  const [devices, setDevices] = useState<DeviceDraft[]>(data.devices.map((device) => ({ key: device.id, id: device.id,
    platform: device.platform, major: String(device.os_major), minor: device.os_minor === null ? "" : String(device.os_minor), model: device.model ?? "" })));
  const [editor, setEditor] = useState<string | null>(null);
  const [name, setName] = useState(data.profile.display_name ?? "");
  const [country, setCountry] = useState(data.profile.country_code ?? "");
  const [email, setEmail] = useState(data.profile.testing_email ?? "");
  const [intent, setIntent] = useState(data.profile.initial_intent ?? "");
  const [state, action, pending] = useActionState<ProfileResult, FormData>(async (_previous, form) => {
    try { return await updateMyProfile(form); }
    catch { return { error: "failed" }; }
    finally { inFlight.current = false; }
  }, {});
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  function edit(key: string, fields: Partial<DeviceDraft>) {
    setDevices((current) => current.map((device) => device.key === key ? { ...device, ...fields } : device));
  }
  function add(platform: "android" | "ios") {
    if (pending || inFlight.current || devices.length >= 2 || devices.some((device) => device.platform === platform)) return;
    const key = `new-${++newDevice.current}`;
    setDevices((current) => [...current, { key, platform, major: "", minor: "", model: "" }]); setEditor(key);
  }
  const serialized = devices.map((device) => ({ ...(device.id ? { id: device.id } : {}), platform: device.platform,
    os_major: device.major === "" ? null : Number(device.major), os_minor: device.minor === "" ? null : Number(device.minor), model: device.model }));
  return <>
    <PageHeading eyebrow={<T id="profile.eyebrow" />} title={<T id="profile.title" />} description={<T id="profile.description" />} action={<button className="button button-primary" form="profile-form" type="submit" disabled={pending}><T id="profile.save" /></button>} />
    <form id="profile-form" action={action} aria-busy={pending} onSubmit={(event) => {
      if (pending || inFlight.current) event.preventDefault(); else inFlight.current = true;
    }}>
      <input type="hidden" name="devices" value={JSON.stringify(serialized)} />
      <div className="profile-layout">
        <div className="profile-main">
          <section className="panel profile-card">
            <div className="profile-section-head"><div><h2><T id="profile.personalInfo" /></h2><p><T id="profile.personalDescription" /></p></div></div>
            <div className="profile-identity"><span className="profile-big-avatar">{initials || "—"}</span><div><strong>{name.trim() || "—"}</strong><span><T id="profile.created" /> <time dateTime={data.profile.created_at}>{new Intl.DateTimeFormat(language === "es" ? "es-MX" : "en-US", { dateStyle: "medium", timeZone: "America/Cancun" }).format(new Date(data.profile.created_at))}</time></span></div></div>
            <div className="profile-fields">
              <label className="field"><span><T id="profile.name" /></span><input name="display_name" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} /></label>
              <label className="field"><span><T id="profile.country" /></span><input name="country_code" value={country} onChange={(event) => setCountry(event.target.value)} required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" autoCapitalize="characters" disabled={pending} /></label>
              <label className="field"><span><T id="profile.intent" /></span><select name="initial_intent" value={intent} onChange={(event) => setIntent(event.target.value as typeof intent)} required disabled={pending}><option value="" disabled>—</option>{Object.entries(intents).map(([value, label]) => <option key={value} value={value}><T id={label} /></option>)}</select></label>
              <div><small><T id="profile.language" /></small><strong><CurrentLanguageName /></strong></div>
            </div>
          </section>
          <section className="panel profile-card">
            <div className="profile-section-head"><div><h2><T id="profile.devices" /></h2><p><T id="profile.devicesDescription" /></p></div><div>{(["android", "ios"] as const).filter((platform) => !devices.some((device) => device.platform === platform)).map((platform) => <button key={platform} className="quiet-link" type="button" disabled={pending || devices.length >= 2} onClick={() => add(platform)}><T id="profile.addDevice" /> {platform === "ios" ? "iOS" : "Android"}</button>)}</div></div>
            <div className="device-list">{devices.map((device) => <div key={device.key}>
              <div className="device-row"><span className="device-round"><Smartphone size={19} /></span><span><strong>{device.model.trim() || (device.platform === "ios" ? "iOS" : "Android")}</strong><small>{device.platform === "ios" ? "iOS" : "Android"} {device.major}{device.minor !== "" ? `.${device.minor}` : ""}</small>{device.id && <small>{device.id}</small>}</span><button type="button" className="quiet-link" disabled={pending} onClick={() => setEditor(editor === device.key ? null : device.key)}><T id="common.edit" /></button><button type="button" className="quiet-link" disabled={pending || devices.length <= 1} onClick={() => { if (!pending && !inFlight.current && devices.length > 1) { setDevices((current) => current.filter((row) => row.key !== device.key)); if (editor === device.key) setEditor(null); } }}><T id="profile.removeDevice" /></button></div>
              {editor === device.key && <div className="form-grid">
                <label className="field"><span><T id="campaignForm.platform" /></span><select value={device.platform} disabled={pending} onChange={(event) => edit(device.key, { platform: event.target.value as DeviceDraft["platform"] })}>{(["android", "ios"] as const).map((platform) => <option key={platform} value={platform} disabled={devices.some((other) => other.key !== device.key && other.platform === platform)}>{platform === "ios" ? "iOS" : "Android"}</option>)}</select></label>
                <label className="field"><span><T id="onboarding.systemMajor" /></span><input type="number" min={0} max={32767} step={1} value={device.major} disabled={pending} onChange={(event) => edit(device.key, { major: event.target.value })} /></label>
                <label className="field"><span><T id="onboarding.systemMinor" /> (<T id="onboarding.optional" />)</span><input type="number" min={0} max={32767} step={1} value={device.minor} disabled={pending} onChange={(event) => edit(device.key, { minor: event.target.value })} /></label>
                <label className="field"><span><T id="onboarding.deviceModel" /> (<T id="onboarding.optional" />)</span><input value={device.model} disabled={pending} onChange={(event) => edit(device.key, { model: event.target.value })} /></label>
              </div>}
            </div>)}</div>
          </section>
          <section className="panel profile-card"><div className="profile-section-head"><div><h2><T id="profile.testingEmail" /></h2><p><T id="profile.testingEmailDescription" /></p></div></div><div className="testing-email"><span><Mail size={18} /></span><label className="field"><span><T id="profile.testingEmail" /></span><input name="testing_email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} /></label></div></section>
          {data.anomalous && <p role="status"><T id="profile.anomalous" /></p>}
          {state.error && <p role="alert"><T id={errors[state.error]} /></p>}
          {state.saved && <p role="status"><T id="profile.saved" /></p>}
          {pending && <p role="status"><T id="onboarding.saving" /></p>}
        </div>
        <aside className="profile-side"><section className="panel security-card"><span className="security-icon"><LockKeyhole size={18} /></span><h3><T id="profile.privacyTitle" /></h3><p><T id="profile.privacyDescription" /></p></section></aside>
      </div>
    </form>
  </>;
}
