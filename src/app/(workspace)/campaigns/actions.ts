"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAppId } from "@/lib/apps";
import { campaignInput, campaignError, type CampaignResult } from "@/lib/campaign-input";
import { getOwnCampaign } from "@/lib/own-campaigns";
import { createClient } from "@/lib/supabase/server";

function refresh(appId: string, campaignId: string) {
  revalidatePath("/apps");
  revalidatePath(`/apps/${appId}`);
  revalidatePath(`/campaigns/${campaignId}/edit`);
}
export async function createCampaign(appId: string, form: FormData): Promise<CampaignResult> {
  if (!isAppId(appId)) return { error: "unavailable" };
  const input = campaignInput(form, true);
  if (input.error) return { error: input.error };
  let id: string;
  try {
    const supabase = await createClient();
    if (!await getCurrentUser(supabase)) return { error: "auth" };
    const { data, error } = await supabase.rpc("create_campaign", { p_app_id: appId, ...input.fields });
    if (error) return { error: campaignError(error) };
    if (!data || !isAppId(data.id)) return { error: "failed" };
    id = data.id;
  } catch { return { error: "failed" }; }
  refresh(appId, id);
  redirect(`/campaigns/${id}/edit`);
}
export async function mutateCampaign(id: string, form: FormData): Promise<CampaignResult> {
  if (!isAppId(id)) return { error: "unavailable" };
  let appId: string;
  try {
    const supabase = await createClient();
    if (!await getCurrentUser(supabase)) return { error: "auth" };
    const campaign = await getOwnCampaign(id);
    if (!campaign) return { error: "unavailable" };
    appId = campaign.app_id;
    const operation = form.get("operation");
    let result;
    if (operation === "save") {
      const input = campaignInput(form, !campaign.has_participations);
      if (input.error) return { error: input.error };
      // A fresh server read determines the lock. No structural parameter is sent once any participation exists.
      result = await supabase.rpc("update_campaign", { p_campaign_id: id, ...input.fields,
        ...(!campaign.has_participations ? { p_min_os_major_set: true, p_min_os_minor_set: true } : {}) });
    } else if (operation === "publish") {
      result = await supabase.rpc("publish_campaign", { p_campaign_id: id });
    } else if (operation === "cancel") {
      const reason = form.get("reason");
      result = await supabase.rpc("cancel_campaign", { p_campaign_id: id, p_reason: typeof reason === "string" ? reason.trim() || null : null });
    } else return { error: "failed" };
    if (result.error) return { error: campaignError(result.error) };
  } catch { return { error: "failed" }; }
  refresh(appId, id);
  return { saved: true };
}
