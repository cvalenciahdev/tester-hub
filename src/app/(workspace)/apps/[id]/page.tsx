import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, PageHeading } from "@/components/ui";
import { T } from "@/lib/i18n";
import { getOwnApp } from "@/lib/apps";
import { AppForm } from "../app-form";
import { AppArchivedAt } from "../apps-controls";

export default async function AppPage({ params }: PageProps<"/apps/[id]">) {
  const { id } = await params;
  const app = await getOwnApp(id);
  if (!app) notFound();
  return <>
    <Link className="back-link" href="/apps"><ArrowLeft size={16} /><T id="apps.back" /></Link>
    <PageHeading title={app.name} description={app.description ?? ""} action={<Badge status={app.archived_at === null ? "Activa" : "Archivada"} />} />
    <p className="muted-cell"><AppArchivedAt value={app.archived_at} /></p>
    <AppForm app={app} />
  </>;
}
