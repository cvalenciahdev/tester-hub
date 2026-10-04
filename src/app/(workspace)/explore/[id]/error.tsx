"use client";

import { EmptyHint } from "@/components/ui";
import { T } from "@/lib/i18n";

export default function DetailError({ retry }: { retry: () => void }) {
  return (
    <section className="panel" role="alert">
      <EmptyHint><T id="detail.loadError" /></EmptyHint>
      <button className="button button-secondary button-small" onClick={retry} type="button"><T id="explore.retry" /></button>
    </section>
  );
}
