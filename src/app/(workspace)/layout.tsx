import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { getCurrentUser, getOnboardingStatus, getUserDisplayName, getUserInitials } from "@/lib/auth";
import { isAuthServiceUnavailableError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  let user: User | null;

  try {
    user = await getCurrentUser(supabase);
  } catch (error) {
    if (isAuthServiceUnavailableError(error)) {
      return <ServiceUnavailable />;
    }

    throw error;
  }

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
