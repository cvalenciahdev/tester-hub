"use client";
import { EmptyHint } from "@/components/ui";
import { T } from "@/lib/i18n";
export default function AppsError({ retry }: { retry: () => void }) {
  return <section className="panel" role="alert"><EmptyHint><T id="apps.loadError" /></EmptyHint><button className="button button-secondary button-small" type="button" onClick={retry}><T id="apps.retry" /></button></section>;
}
