"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAppId } from "@/lib/apps";
import { createClient } from "@/lib/supabase/server";

export type TrackingMutation = { error?: "auth" | "unavailable" | "state" | "failed"; saved?: boolean };
async function mutate(campaignId: string, participationId: string, operation: "enable_access" | "cancel_participation", reason?: string): Promise<TrackingMutation> {
  if (!isAppId(campaignId) || !isAppId(participationId)) return { error: "unavailable" };
  let appId: string;
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) return { error: "auth" };
    // Bind the action to this campaign as well as its owner. RLS and the RPC remain authoritative.
    const { data, error } = await supabase.from("test_participations")
      .select("campaign_id,test_campaigns!inner(app_id,apps!inner(owner_id))")
      .eq("id", participationId).eq("campaign_id", campaignId).eq("test_campaigns.apps.owner_id", user.id).maybeSingle();
    if (error) return { error: "failed" };
    if (!data) return { error: "unavailable" };
    const campaign = data.test_campaigns as unknown as { app_id: string };
    if (!isAppId(campaign?.app_id)) return { error: "failed" };
    appId = campaign.app_id;
    const result = await supabase.rpc(operation, { p_participation_id: participationId,
      ...(operation === "cancel_participation" ? { p_reason: typeof reason === "string" ? reason.trim() || null : null } : {}) });
    if (result.error) {
      const message = result.error.message;
      if (message === "NOT_AUTHENTICATED") return { error: "auth" };
      if (message === "INVALID_PARTICIPATION_STATE") return { error: "state" };
      if (["PARTICIPATION_NOT_FOUND", "CAMPAIGN_NOT_FOUND", "APP_NOT_FOUND", "NOT_CAMPAIGN_OWNER"].includes(message)) return { error: "unavailable" };
      return { error: "failed" };
    }
  } catch { return { error: "failed" }; }
  revalidatePath(`/campaigns/${campaignId}/tracking`);
  revalidatePath(`/apps/${appId}`);
  revalidatePath(`/campaigns/${campaignId}/edit`);
  revalidatePath("/my-tests");
  return { saved: true };
}
export async function enableTrackedAccess(campaignId: string, participationId: string): Promise<TrackingMutation> {
  return mutate(campaignId, participationId, "enable_access");
}
export async function cancelTrackedParticipation(campaignId: string, participationId: string, reason?: string): Promise<TrackingMutation> {
  return mutate(campaignId, participationId, "cancel_participation", reason);
}
