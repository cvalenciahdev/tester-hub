"use client";
import { EmptyHint } from "@/components/ui";
import { T } from "@/lib/i18n";
export default function ProfileError({ retry }: { retry: () => void }) { return <section className="panel" role="alert"><EmptyHint><T id="profile.loadError" /></EmptyHint><button type="button" className="button button-secondary" onClick={retry}><T id="apps.retry" /></button></section>; }
