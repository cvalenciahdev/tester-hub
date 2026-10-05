import { redirect } from "next/navigation";
import { getProfileData } from "@/lib/profile";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const data = await getProfileData();
  if (!data) redirect("/onboarding");
  if (!data.complete) redirect("/onboarding");
  return <ProfileForm key={JSON.stringify(data)} data={data} />;
}
