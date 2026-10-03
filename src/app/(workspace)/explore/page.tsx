import { ChevronLeft, ChevronRight } from "lucide-react";
import { campaigns } from "@/lib/mock-data";
import { CampaignCard, PageHeading } from "@/components/ui";
import { T, TranslatedIconButton } from "@/lib/i18n";

export default function ExplorePage() {
  return (
    <>
      <PageHeading
        eyebrow={<T id="explore.eyebrow" />}
        title={<T id="explore.title" />}
        description={<T id="explore.description" />}
      />
      <div className="platform-filter-panel">
        <div className="platform-filter-group">
          <span className="platform-filter-label" id="explore-platform-label"><T id="explore.platform" /></span>
          <div
            className="platform-filter-options"
            aria-labelledby="explore-platform-label"
          >
            <button
              className="platform-filter-option platform-filter-active"
              type="button"
              aria-pressed="true"
            >
              <T id="explore.allPlatforms" />
            </button>
            <button
              className="platform-filter-option"
              type="button"
              aria-pressed="false"
            >
              <T id="explore.android" />
            </button>
            <button
              className="platform-filter-option"
              type="button"
              aria-pressed="false"
            >
              <T id="explore.ios" />
            </button>
          </div>
        </div>
        <div className="page-size-group">
          <label className="page-size">
            <span><T id="explore.show" /></span>
            <select
              defaultValue="12"
            >
              <option>12</option>
              <option>24</option>
              <option>48</option>
            </select>
            <span><T id="explore.perPage" /></span>
          </label>
        </div>
      </div>
      <div className="campaign-results-heading">
        <h2>{campaigns.length} <T id="explore.available" /></h2>
      </div>
      <div className="campaign-grid">
        {campaigns.map((campaign) => (
          <CampaignCard campaign={campaign} key={campaign.id} />
        ))}
      </div>
      <div className="pagination">
        <span className="page-count">
          <T id="explore.pageRange" values={{ start: 1, end: campaigns.length, total: campaigns.length }} />
        </span>
        <nav
          className="pagination-controls"
          aria-labelledby="campaign-pagination-label"
        >
          <span className="sr-only" id="campaign-pagination-label"><T id="explore.pagination" /></span>
          <TranslatedIconButton label="explore.previousPage" className="page-button" disabled>
            <ChevronLeft size={15} />
          </TranslatedIconButton>
          <button
            className="page-button page-button-active"
            aria-current="page"
          >
            1
          </button>
          <button className="page-button">2</button>
          <button className="page-button">3</button>
          <span className="page-ellipsis">…</span>
          <TranslatedIconButton label="explore.nextPage" className="page-button">
            <ChevronRight size={15} />
          </TranslatedIconButton>
        </nav>
      </div>
    </>
  );
}
