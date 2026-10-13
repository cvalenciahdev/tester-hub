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
  const operation = form.get("operation");
  if (operation !== null && operation !== "save" && operation !== "publish") return { error: "failed" };
  const input = campaignInput(form, true);
  if (input.error) return { error: input.error };
  let id: string;
  try {
    const supabase = await createClient();
    if (!await getCurrentUser(supabase)) return { error: "auth" };
    const { data, error } = await supabase.rpc("create_campaign", { p_app_id: appId, ...input.fields, p_min_os_major: null, p_min_os_minor: null });
    if (error) return { error: campaignError(error) };
    if (!data || !isAppId(data.id)) return { error: "failed" };
    id = data.id;
  } catch { return { error: "failed" }; }
  refresh(appId, id);
  revalidatePath(`/apps/${appId}/campaigns`);
  if (operation === "publish") {
    // These RPCs commit separately. Never conceal a saved campaign or create another on a publication retry.
    const publication = new FormData();
    publication.set("operation", "publish");
    let result: CampaignResult;
    try { result = await mutateCampaign(id, publication); }
    catch { result = { error: "failed" }; }
    if (result.error) {
      let current;
      try { current = await getOwnCampaign(id); } catch { /* Publication outcome may be unknown after a connection failure. */ }
      return { error: result.error, createdCampaign: { id, confirmedDraft: current?.status === "draft" } };
    }
    revalidatePath(`/apps/${appId}/campaigns`);
  }
  redirect(`/apps/${appId}/campaigns`);
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
    if (operation === "save" || operation === "save-and-publish") {
      const input = campaignInput(form, !campaign.has_participations);
      if (input.error) return { error: input.error };
      // A fresh server read determines the lock. No structural parameter is sent once any participation exists.
      // Omit removed OS fields and their set flags: partial update preserves legacy values.
      result = await supabase.rpc("update_campaign", { p_campaign_id: id, ...input.fields });
    } else if (operation === "publish") {
      result = await supabase.rpc("publish_campaign", { p_campaign_id: id });
    } else if (operation === "cancel") {
      const reason = form.get("reason");
      result = await supabase.rpc("cancel_campaign", { p_campaign_id: id, p_reason: typeof reason === "string" ? reason.trim() || null : null });
    } else return { error: "failed" };
    if (result.error) return { error: campaignError(result.error) };
    if (operation === "save-and-publish") {
      const publication = await supabase.rpc("publish_campaign", { p_campaign_id: id });
      if (publication.error) return { error: campaignError(publication.error) };
    }
  } catch { return { error: "failed" }; }
  refresh(appId, id);
  if (form.get("operation") === "save" || form.get("operation") === "save-and-publish") {
    redirect(`/apps/${appId}/campaigns`);
  }
  return { saved: true };
}
