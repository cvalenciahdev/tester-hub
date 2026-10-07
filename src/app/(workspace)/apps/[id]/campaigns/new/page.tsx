import { notFound } from "next/navigation";
import { EmptyHint } from "@/components/ui";
import { SetWorkspaceBreadcrumb } from "@/components/workspace-breadcrumb";
import { T } from "@/lib/i18n";
import { getOwnApp } from "@/lib/apps";
import { CampaignForm } from "@/app/(workspace)/campaigns/campaign-form";
import styles from "@/app/(workspace)/campaigns/campaign-editor.module.css";

export default async function NewRoundPage({ params }: PageProps<"/apps/[id]/campaigns/new">) {
  const { id } = await params;
  const app = await getOwnApp(id);
  if (!app) notFound();
  return <>
    <SetWorkspaceBreadcrumb pathname={`/apps/${app.id}/campaigns/new`} workspaceHref="/dashboard" items={[
      { translationKey: "common.myApps", href: "/apps" },
      { label: app.name, href: `/apps/${app.id}` },
      { translationKey: "apps.campaigns", href: `/apps/${app.id}/campaigns` },
      { translationKey: "roundForm.newBreadcrumb" },
    ]} />
    <header className={styles.heading}><h1><T id="common.newCampaign" /></h1></header>
    {app.archived_at !== null ? <section className="panel"><EmptyHint><T id="roundForm.errorArchived" /></EmptyHint></section> : <CampaignForm appId={app.id} />}
  </>;
}
