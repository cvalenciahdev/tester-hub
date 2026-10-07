import { notFound } from "next/navigation";
import { SetWorkspaceBreadcrumb } from "@/components/workspace-breadcrumb";
import { T, type TranslationKey } from "@/lib/i18n";
import { getOwnCampaign } from "@/lib/own-campaigns";
import type { RoundStatus } from "@/lib/app-rounds";
import { CampaignForm } from "../../campaign-form";
import styles from "../../campaign-editor.module.css";

const statusKeys: Record<RoundStatus, TranslationKey> = { draft: "status.Draft", recruiting: "status.Recruiting", testing: "status.Testing", completed: "status.Completed", cancelled: "status.Cancelled" };
export default async function EditRoundPage({ params }: PageProps<"/campaigns/[id]/edit">) {
  const { id } = await params;
  const campaign = await getOwnCampaign(id);
  if (!campaign) notFound();
  return <>
    <SetWorkspaceBreadcrumb pathname={`/campaigns/${campaign.id}/edit`} workspaceHref="/dashboard" items={[
      { translationKey: "common.myApps", href: "/apps" },
      { label: campaign.app_name, href: `/apps/${campaign.app_id}` },
      { translationKey: "apps.campaigns", href: `/apps/${campaign.app_id}/campaigns` },
      { translationKey: "campaigns.edit" },
    ]} />
    <header className={styles.heading}><h1><T id="common.editCampaign" /></h1><span className="badge badge-neutral"><T id={statusKeys[campaign.status]} /></span></header>
    <CampaignForm appId={campaign.app_id} campaign={campaign} />
  </>;
}
