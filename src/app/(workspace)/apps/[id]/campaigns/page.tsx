import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui";
import { T } from "@/lib/i18n";
import { getOwnApp } from "@/lib/apps";
import { getAppRounds, parseRoundFilter } from "@/lib/app-rounds";
import { AppRounds } from "../app-rounds";

export default async function AppCampaignsPage({ params, searchParams }: PageProps<"/apps/[id]/campaigns">) {
  const { id } = await params;
  const app = await getOwnApp(id);
  if (!app) notFound();
  const filter = parseRoundFilter((await searchParams).round_status);
  const rounds = await getAppRounds(app.id);
  return <>
    <nav className="back-link">
      <Link href="/apps"><T id="apps.title" /></Link><span>/</span>
      <Link href={`/apps/${app.id}`}>{app.name}</Link><span>/</span><span><T id="apps.campaigns" /></span>
    </nav>
    <PageHeading title={app.name} description={app.description ?? ""} action={app.archived_at === null ? <Link className="button button-primary" href={`/apps/${app.id}/campaigns/new`}><T id="apps.newCampaign" /></Link> : undefined} />
    <AppRounds appId={app.id} appName={app.name} rounds={rounds} filter={filter} archived={app.archived_at !== null} />
  </>;
}
