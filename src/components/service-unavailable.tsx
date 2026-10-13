"use client";

import { T } from "@/lib/i18n";

export function ServiceUnavailable() {
  function retry() {
    const url = new URL(window.location.href);

    if (url.searchParams.get("error") === "service_unavailable") {
      url.searchParams.delete("error");
      window.location.replace(`${url.pathname}${url.search}${url.hash}`);
      return;
    }

    window.location.reload();
  }

  return (
    <main className="auth-page">
      <section className="auth-card" role="alert">
        <h1><T id="common.serviceUnavailable" /></h1>
        <button
          className="button button-primary"
          onClick={retry}
          type="button"
        >
          <T id="common.retry" />
        </button>
      </section>
    </main>
  );
}
