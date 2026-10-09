import { notFound } from "next/navigation";
import { Badge, PageHeading } from "@/components/ui";
import { getOwnApp } from "@/lib/apps";
import { AppForm } from "../app-form";
import { AppArchivedAt } from "../apps-controls";

export default async function AppPage({ params }: PageProps<"/apps/[id]">) {
  const { id } = await params;
  const app = await getOwnApp(id);
  if (!app) notFound();
  return <>
    
    <PageHeading title="" description="" action={<Badge status={app.archived_at === null ? "Activa" : "Archivada"} />} />
    <p className="muted-cell"><AppArchivedAt value={app.archived_at} /></p>
    <AppForm app={app} />
  </>;
}
