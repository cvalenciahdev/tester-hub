import Link from "next/link";
import { EmptyHint } from "@/components/ui";
import { T, type TranslationKey } from "@/lib/i18n";
import type { AppRound, RoundFilter, RoundStatus } from "@/lib/app-rounds";
import { RoundFilterControl } from "./round-filter";
import styles from "./campaigns/campaign-list.module.css";

const statuses: Record<RoundStatus, { key: TranslationKey; style: string }> = {
  draft: { key: "status.Draft", style: "badge-neutral" },
  recruiting: { key: "status.Recruiting", style: "badge-blue" },
  testing: { key: "status.Testing", style: "badge-violet" },
  completed: { key: "status.Completed", style: "badge-green" },
  cancelled: { key: "status.Cancelled", style: "badge-red" },
};
export function AppRounds({ appId, appName, rounds, filter, archived }: { appId: string; appName: string; rounds: AppRound[]; filter: RoundFilter; archived: boolean }) {
  const visible = rounds.filter((round) => filter === "all" || round.status === filter);
  return <section className={`panel table-panel ${styles.panel}`}>
    <div className={`table-toolbar ${styles.toolbar}`}>
      <span className={styles.count}><T id={rounds.length === 1 ? "apps.campaignCountOne" : "apps.campaignCount"} values={{ count: rounds.length }} /></span>
      <RoundFilterControl appId={appId} filter={filter} />
    </div>
    {visible.length === 0 ? <EmptyHint>
      <T id={rounds.length === 0 ? "apps.noRounds" : "apps.roundsEmptyFiltered"} />
      {rounds.length > 0 && <> <Link className="text-link" href={`/apps/${appId}/campaigns`}><T id="apps.roundsAll" /></Link></>}
    </EmptyHint> : <div className="table-scroll"><table>
      <thead><tr><th><T id="campaigns.name" /></th><th><T id="campaigns.status" /></th><th><T id="campaigns.platform" /></th><th><T id="campaigns.testers" /></th><th><T id="campaigns.actions" /></th></tr></thead>
      <tbody>{visible.map((round) => {
        const status = statuses[round.status];
        return <tr key={round.id}>
          <td><div className={`campaign-table-name ${styles.name}`}><strong>{appName}</strong></div></td>
          <td><span className={`badge ${status.style}`}><T id={status.key} /></span></td>
          <td className="muted-cell"><T id={round.platform === "android" ? "explore.android" : "explore.ios"} /><br /><small><T id="dashboard.durationDays" values={{ count: round.duration_days }} /></small></td>
          <td className="muted-cell">{round.covered_testers} / {round.target_testers}<br /><small><T id="apps.roundSlots" values={{ count: round.available_slots }} /></small>{round.participation_count === 0 && <><br /><small><T id="apps.roundNoTesters" /></small></>}</td>
          <td><div className="table-actions">{!archived && round.status !== "completed" && round.status !== "cancelled" && <Link className="text-link" href={`/campaigns/${round.id}/edit`}><T id="campaigns.edit" /></Link>}<Link className="text-link" href={`/campaigns/${round.id}/tracking`}><T id="tracking.open" /></Link></div></td>
        </tr>;
      })}</tbody>
    </table></div>}
  </section>;
}
