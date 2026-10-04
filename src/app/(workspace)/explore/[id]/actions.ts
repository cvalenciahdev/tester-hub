"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getExploreCampaignDetail, isCampaignId } from "@/lib/explore";
import { createClient } from "@/lib/supabase/server";

export type JoinResult = {
  error?: "ALREADY_JOINED" | "NO_AVAILABLE_SLOTS" | "OWNER_CANNOT_JOIN" | "TESTING_EMAIL_REQUIRED" | "CAMPAIGN_NOT_OPEN" | "CAMPAIGN_NOT_AVAILABLE" | "JOIN_FAILED";
};

export async function joinExploreCampaign(campaignId: string): Promise<JoinResult> {
  if (!isCampaignId(campaignId)) return { error: "CAMPAIGN_NOT_AVAILABLE" };
  try {
    const supabase = await createClient();
    if (!await getCurrentUser(supabase)) return { error: "JOIN_FAILED" };
    // join_campaign does not enforce country discovery. Authorize even direct POSTs here.
    const campaign = await getExploreCampaignDetail(campaignId, supabase);
    if (!campaign) return { error: "CAMPAIGN_NOT_AVAILABLE" };
    if (campaign.own_participation) {
      revalidatePath(`/explore/${campaignId}`);
      return { error: "ALREADY_JOINED" };
    }
    if (campaign.available_slots === 0) {
      revalidatePath(`/explore/${campaignId}`);
      return { error: "NO_AVAILABLE_SLOTS" };
    }
    // The mutation response is projected; no email snapshot reaches the action or client.
    const { error } = await supabase.rpc("join_campaign", { p_campaign_id: campaignId }).select("id");
    if (error) {
      const code = error.message;
      if (code === "ALREADY_JOINED" || code === "NO_AVAILABLE_SLOTS" || code === "OWNER_CANNOT_JOIN" ||
          code === "TESTING_EMAIL_REQUIRED" || code === "CAMPAIGN_NOT_OPEN") {
        revalidatePath(`/explore/${campaignId}`);
        return { error: code };
      }
      return { error: "JOIN_FAILED" };
    }
  } catch {
    return { error: "JOIN_FAILED" };
  }
  revalidatePath(`/explore/${campaignId}`);
  revalidatePath("/explore");
  return {};
}
