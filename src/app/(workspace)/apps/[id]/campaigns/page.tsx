import Link from "next/link";
import { Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { SetWorkspaceBreadcrumb } from "@/components/workspace-breadcrumb";
import { T } from "@/lib/i18n";
import { getOwnApp } from "@/lib/apps";
import { getAppRounds, parseRoundFilter } from "@/lib/app-rounds";
import { AppRounds } from "../app-rounds";
import styles from "./campaign-list.module.css";

export default async function AppCampaignsPage({ params, searchParams }: PageProps<"/apps/[id]/campaigns">) {
  const { id } = await params;
  const app = await getOwnApp(id);
  if (!app) notFound();
  const filter = parseRoundFilter((await searchParams).round_status);
  const rounds = await getAppRounds(app.id);
  return <>
    <SetWorkspaceBreadcrumb pathname={`/apps/${app.id}/campaigns`} items={[
      { translationKey: "common.myApps", href: "/apps" },
      { label: app.name, href: `/apps/${app.id}` },
      { translationKey: "apps.campaigns" },
    ]} />
    <header className={styles.heading}>
      <h1>{app.name}</h1>
      {app.archived_at === null && <Link className="button button-primary" href={`/apps/${app.id}/campaigns/new`}><Plus size={17} /><T id="apps.newCampaign" /></Link>}
    </header>
    <AppRounds appId={app.id} appName={app.name} rounds={rounds} filter={filter} archived={app.archived_at !== null} />
  </>;
}
