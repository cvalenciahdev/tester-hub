import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { T, type TranslationKey } from "@/lib/i18n";
import { getOwnCampaign } from "@/lib/own-campaigns";
import type { RoundStatus } from "@/lib/app-rounds";
import { CampaignForm } from "../../campaign-form";

const statusKeys: Record<RoundStatus, TranslationKey> = { draft: "status.Draft", recruiting: "status.Recruiting", testing: "status.Testing", completed: "status.Completed", cancelled: "status.Cancelled" };
export default async function EditRoundPage({ params }: PageProps<"/campaigns/[id]/edit">) {
  const { id } = await params;
  const campaign = await getOwnCampaign(id);
  if (!campaign) notFound();
  return <>
    <Link className="back-link" href={`/apps/${campaign.app_id}/campaigns`}><ArrowLeft size={16} /><T id="apps.backToCampaigns" /></Link>
    <PageHeading title={campaign.app_name} description={campaign.app_description ?? ""} action={<span className="badge badge-neutral"><T id={statusKeys[campaign.status]} /></span>} />
    <p className="muted-cell">{campaign.id}</p>
    <CampaignForm appId={campaign.app_id} campaign={campaign} />
  </>;
}
