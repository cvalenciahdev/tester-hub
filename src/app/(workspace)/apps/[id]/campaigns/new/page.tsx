import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading, EmptyHint } from "@/components/ui";
import { T } from "@/lib/i18n";
import { getOwnApp } from "@/lib/apps";
import { CampaignForm } from "@/app/(workspace)/campaigns/campaign-form";

export default async function NewRoundPage({ params }: PageProps<"/apps/[id]/campaigns/new">) {
  const { id } = await params;
  const app = await getOwnApp(id);
  if (!app) notFound();
  return <>
    <Link className="back-link" href={`/apps/${app.id}`}><ArrowLeft size={16} /><T id="roundForm.back" /></Link>
    <PageHeading eyebrow={<T id="roundForm.new" />} title={app.name} description={app.description ?? ""} />
    {app.archived_at !== null ? <section className="panel"><EmptyHint><T id="roundForm.errorArchived" /></EmptyHint></section> : <CampaignForm appId={app.id} />}
  </>;
}
