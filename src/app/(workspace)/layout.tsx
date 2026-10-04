import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser, getOnboardingStatus, getUserDisplayName, getUserInitials } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { complete, profile } = await getOnboardingStatus(supabase, user.id);

  if (!complete) {
    redirect("/onboarding");
  }

  const displayName = getUserDisplayName(user, profile);

  return (
    <AppShell
      displayName={displayName}
      email={user.email ?? ""}
      initials={getUserInitials(displayName)}
    >
      {children}
    </AppShell>
  );
}
