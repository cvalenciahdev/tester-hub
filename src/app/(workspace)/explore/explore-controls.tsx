"use client";

import { Fragment, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ExploreQuery } from "@/lib/explore";
import { T, useI18n } from "@/lib/i18n";

export function ExploreControls({ query, totalCount }: { query: ExploreQuery; totalCount?: number }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  function navigate(next: ExploreQuery) {
    const params = new URLSearchParams({ limit: String(next.limit), page: String(next.page) });
    if (next.platform) params.set("platform", next.platform);
    startTransition(() => router.push(`/explore?${params.toString()}`, { scroll: false }));
  }

  if (totalCount === undefined) {
    return (
      <div className="platform-filter-panel" aria-busy={pending}>
        <div className="platform-filter-group">
          <span className="platform-filter-label" id="explore-platform-label"><T id="explore.platform" /></span>
          <div className="platform-filter-options" role="group" aria-labelledby="explore-platform-label">
            {([null, "android", "ios"] as const).map((platform) => (
              <button key={platform ?? "all"} className={`platform-filter-option${query.platform === platform ? " platform-filter-active" : ""}`} type="button" aria-pressed={query.platform === platform} disabled={pending} onClick={() => navigate({ ...query, platform, page: 1 })}>
                <T id={platform === null ? "explore.allPlatforms" : platform === "android" ? "explore.android" : "explore.ios"} />
              </button>
            ))}
          </div>
        </div>
        <div className="page-size-group">
          <label className="page-size">
            <span><T id="explore.show" /></span>
            <select value={query.limit} disabled={pending} onChange={(event) => navigate({ ...query, limit: Number(event.target.value) as ExploreQuery["limit"], page: 1 })}>
              <option value="12">12</option><option value="24">24</option><option value="48">48</option>
            </select>
            <span><T id="explore.perPage" /></span>
          </label>
        </div>
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(totalCount / query.limit));
  const visiblePages = [...new Set([1, query.page - 1, query.page, query.page + 1, pages])].filter((page) => page >= 1 && page <= pages).sort((a, b) => a - b);
  return (
    <div className="pagination" aria-busy={pending}>
      <span className="page-count"><T id="explore.pageRange" values={{ start: totalCount === 0 ? 0 : (query.page - 1) * query.limit + 1, end: Math.min(query.page * query.limit, totalCount), total: totalCount }} /></span>
      <nav className="pagination-controls" aria-label={t("explore.pagination")}>
        <button className="page-button" type="button" aria-label={t("explore.previousPage")} disabled={pending || query.page === 1} onClick={() => navigate({ ...query, page: query.page - 1 })}><ChevronLeft size={15} /></button>
        {visiblePages.map((page, index) => (
          <Fragment key={page}>
            {index > 0 && page - visiblePages[index - 1] > 1 && <span className="page-ellipsis">…</span>}
            <button className={`page-button${page === query.page ? " page-button-active" : ""}`} type="button" aria-current={page === query.page ? "page" : undefined} disabled={pending} onClick={() => navigate({ ...query, page })}>{page}</button>
          </Fragment>
        ))}
        <button className="page-button" type="button" aria-label={t("explore.nextPage")} disabled={pending || query.page >= pages} onClick={() => navigate({ ...query, page: query.page + 1 })}><ChevronRight size={15} /></button>
      </nav>
    </div>
  );
}
