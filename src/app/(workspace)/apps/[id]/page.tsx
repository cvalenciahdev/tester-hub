import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, PageHeading } from "@/components/ui";
import { T } from "@/lib/i18n";
import { getOwnApp } from "@/lib/apps";
import { getAppRounds, parseRoundFilter } from "@/lib/app-rounds";
import { AppForm } from "../app-form";
import { AppArchivedAt } from "../apps-controls";
import { AppRounds } from "./app-rounds";

export default async function AppPage({ params, searchParams }: PageProps<"/apps/[id]">) {
  const { id } = await params;
  const app = await getOwnApp(id);
  if (!app) notFound();
  const filter = parseRoundFilter((await searchParams).round_status);
  const rounds = await getAppRounds(app.id);
  return <>
    <Link className="back-link" href="/apps"><ArrowLeft size={16} /><T id="apps.back" /></Link>
    <PageHeading eyebrow={<T id="apps.eyebrow" />} title={app.name} description={app.description ?? ""} action={<><Badge status={app.archived_at === null ? "Activa" : "Archivada"} />{app.archived_at === null && <Link className="button button-primary" href={`/apps/${app.id}/campaigns/new`}><T id="roundForm.new" /></Link>}</>} />
    <p className="muted-cell"><T id="apps.id" />: {app.id}{" "}<AppArchivedAt value={app.archived_at} /></p>
    <AppForm app={app} />
    <AppRounds appId={app.id} appName={app.name} rounds={rounds} filter={filter} />
  </>;
}
