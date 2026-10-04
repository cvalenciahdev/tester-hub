import Link from "next/link";
import { EmptyHint, PageHeading } from "@/components/ui";
import { T, type TranslationKey } from "@/lib/i18n";
import { filterMyParticipations, getMyTestsData, parseMyTestsFilter, type ParticipationStatus } from "@/lib/my-tests";
import { ParticipationActions } from "./participation-actions";
import { MyTestsEndDate, MyTestsFilterControl } from "./my-tests-controls";

const statuses: Record<ParticipationStatus, { key: TranslationKey; style: string }> = {
  waiting_access: { key: "status.Waiting access", style: "badge-amber" },
  access_enabled: { key: "status.Access enabled", style: "badge-blue" },
  active: { key: "status.Active", style: "badge-green" },
  completed: { key: "status.Completed", style: "badge-green" },
  incompatible: { key: "status.Incompatible", style: "badge-red" },
  abandoned: { key: "status.Abandoned", style: "badge-neutral" },
  cancelled: { key: "status.Cancelled", style: "badge-red" },
};
export default async function MyTestsPage({ searchParams }: PageProps<"/my-tests">) {
  const filter = parseMyTestsFilter((await searchParams).status);
  const data = await getMyTestsData();
  const participations = filterMyParticipations(data.participations, filter);
  return (
    <>
      <PageHeading eyebrow={<T id="tests.eyebrow" />} title={<T id="tests.title" />} description={<T id="tests.description" />} />
      <div className="test-summary-strip">
        <div><span className="summary-dot dot-blue" /><strong>{data.metrics.in_progress}</strong><span><T id="tests.inProgress" /></span></div>
        <div><span className="summary-dot dot-amber" /><strong>{data.metrics.waiting_access}</strong><span><T id="dashboard.waitingAccess" /></span></div>
        <div><span className="summary-dot dot-green" /><strong>{data.metrics.completed}</strong><span><T id="tests.completed" /></span></div>
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar"><div><h2><T id="tests.allParticipations" /></h2><p><T id="tests.pastAndCurrent" /></p></div><MyTestsFilterControl filter={filter} /></div>
        {participations.length === 0 ? <EmptyHint>
          <T id={data.participations.length === 0 ? "tests.empty" : "tests.emptyFiltered"} />{" "}
          <Link className="text-link" href={data.participations.length === 0 ? "/explore" : "/my-tests"}><T id={data.participations.length === 0 ? "tests.explore" : "tests.backToAll"} /></Link>
        </EmptyHint> : <div className="table-scroll"><table>
          <thead><tr><th><T id="campaigns.name" /></th><th><T id="campaigns.status" /></th><th><T id="tests.ending" /></th><th><T id="tests.action" /></th><th /></tr></thead>
          <tbody>{participations.map((row) => {
            const status = statuses[row.participation_status];
            const initials = row.app_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
            return <tr key={row.participation_id}>
              <td><div className="table-app"><span className={`app-mark app-mark-small mark-${row.platform === "ios" ? "lavender" : "mint"}`}>{initials}</span><span><strong>{row.app_name}</strong><small><T id={row.platform === "android" ? "explore.android" : "explore.ios"} /></small></span></div></td>
              <td><span className={`badge ${status.style}`}><T id={status.key} /></span></td>
              <td className="muted-cell"><MyTestsEndDate value={row.expected_end_at} /></td>
              <td><ParticipationActions participation={{ participation_id: row.participation_id, participation_status: row.participation_status, can_complete: row.can_complete }} /></td><td />
            </tr>;
          })}</tbody>
        </table></div>}
      </section>
    </>
  );
}
