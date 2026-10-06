import { PageHeading } from "@/components/ui";
import { T } from "@/lib/i18n";
import { AppForm } from "../app-form";
export default function NewAppPage() {
  return <><PageHeading title={<T id="apps.newApp" />} /><AppForm /></>;
}
