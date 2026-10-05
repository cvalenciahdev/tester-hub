"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAppId } from "@/lib/apps";
import { createClient } from "@/lib/supabase/server";

export type FeedbackResult = { error?: "required" | "auth" | "ownership" | "state" | "missing" | "failed" };
async function mutate(operation: "add_participation_feedback" | "update_participation_feedback", id: string, text: string): Promise<FeedbackResult> {
  if (!isAppId(id)) return { error: "missing" };
  if (typeof text !== "string" || !text.trim()) return { error: "required" };
  try {
    const supabase = await createClient();
    if (!await getCurrentUser(supabase)) return { error: "auth" };
    const { error } = await supabase.rpc(operation, { [operation === "add_participation_feedback" ? "p_participation_id" : "p_feedback_id"]: id, p_feedback_text: text.trim() });
    if (error) {
      const message = error.message;
      if (message === "FEEDBACK_REQUIRED") return { error: "required" };
      if (message === "NOT_AUTHENTICATED") return { error: "auth" };
      if (message === "NOT_PARTICIPATION_OWNER" || message === "NOT_FEEDBACK_OWNER") return { error: "ownership" };
      if (message === "INVALID_PARTICIPATION_STATE") return { error: "state" };
      if (["PARTICIPATION_NOT_FOUND", "FEEDBACK_NOT_FOUND", "CAMPAIGN_NOT_FOUND"].includes(message)) return { error: "missing" };
      return { error: "failed" };
    }
  } catch { return { error: "failed" }; }
  revalidatePath("/my-tests");
  revalidatePath("/campaigns/[id]/tracking", "page");
  return {};
}
export async function addFeedback(participationId: string, text: string): Promise<FeedbackResult> {
  return mutate("add_participation_feedback", participationId, text);
}
export async function updateFeedback(feedbackId: string, text: string): Promise<FeedbackResult> {
  return mutate("update_participation_feedback", feedbackId, text);
}
