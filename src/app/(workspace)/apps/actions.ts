"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAppId } from "@/lib/apps";
import { createClient } from "@/lib/supabase/server";

export type AppMutationResult = { error?: "nameRequired" | "notAuthenticated" | "unavailable" | "saveFailed"; saved?: boolean };
function fields(formData: FormData) {
  const name = formData.get("name");
  const description = formData.get("description");
  if (typeof name !== "string" || !name.trim()) return null;
  if (description !== null && typeof description !== "string") return null;
  return { name: name.trim(), description: typeof description === "string" ? description.trim() || null : null };
}
export async function createApp(formData: FormData): Promise<AppMutationResult> {
  const input = fields(formData);
  if (!input) return { error: "nameRequired" };
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) return { error: "notAuthenticated" };
    const { data, error } = await supabase.from("apps").insert({ owner_id: user.id, ...input }).select("id").single();
    if (error || !data || !isAppId(data.id)) return { error: "saveFailed" };
  } catch { return { error: "saveFailed" }; }
  revalidatePath("/apps");
  redirect("/apps");
}
export async function updateApp(appId: string, formData: FormData): Promise<AppMutationResult> {
  if (!isAppId(appId)) return { error: "unavailable" };
  const input = fields(formData);
  if (!input) return { error: "nameRequired" };
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) return { error: "notAuthenticated" };
    // Update only these two fields. RLS checks ownership; archived apps remain read-only.
    const { data, error } = await supabase.from("apps").update(input).eq("id", appId).eq("owner_id", user.id).is("archived_at", null).select("id").maybeSingle();
    if (error) return { error: "saveFailed" };
    if (!data) return { error: "unavailable" };
  } catch { return { error: "saveFailed" }; }
  revalidatePath("/apps");
  revalidatePath(`/apps/${appId}`);
  redirect("/apps");
}
