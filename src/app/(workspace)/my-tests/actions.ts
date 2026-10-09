"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type MutationResult = {
  error?: "INVALID_PARTICIPATION_STATE" | "TEST_PERIOD_NOT_FINISHED" | "FEEDBACK_REQUIRED" | "REASON_REQUIRED" | "NOT_AUTHENTICATED" | "NOT_PARTICIPATION_TESTER" | "DURATION_OUT_OF_RANGE" | "ACTION_FAILED";
};
type Operation = "confirm_installation" | "complete_participation" | "mark_incompatible" | "abandon_participation";

async function mutate(operation: Operation, participationId: string, reason?: string | null): Promise<MutationResult> {
  if (typeof participationId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(participationId)) {
    return { error: "ACTION_FAILED" };
  }
  if (operation === "mark_incompatible" && (typeof reason !== "string" || !reason.trim())) {
    return { error: "REASON_REQUIRED" };
  }
  if (reason !== undefined && reason !== null && typeof reason !== "string") return { error: "ACTION_FAILED" };
  try {
    const supabase = await createClient();
    if (!await getCurrentUser(supabase)) return { error: "NOT_AUTHENTICATED" };
    const args: { p_participation_id: string; p_reason?: string | null } = { p_participation_id: participationId };
    if (operation === "mark_incompatible" || operation === "abandon_participation") args.p_reason = reason?.trim() || null;
    // Each RPC verifies tester ownership and the transition. Discard its private row fields.
    const { error } = await supabase.rpc(operation, args).select("id");
    if (error) {
      const code = error.message;
      if (code === "INVALID_PARTICIPATION_STATE" || code === "TEST_PERIOD_NOT_FINISHED" ||
          code === "FEEDBACK_REQUIRED" || code === "REASON_REQUIRED" || code === "NOT_AUTHENTICATED" || code === "NOT_PARTICIPATION_TESTER" || code === "DURATION_OUT_OF_RANGE") {
        return { error: code };
      }
      return { error: "ACTION_FAILED" };
    }
  } catch {
    return { error: "ACTION_FAILED" };
  }
  revalidatePath("/my-tests");
  return {};
}
export async function confirmInstallation(participationId: string): Promise<MutationResult> {
  return mutate("confirm_installation", participationId);
}
export async function completeParticipation(participationId: string): Promise<MutationResult> {
  return mutate("complete_participation", participationId);
}
export async function markIncompatible(participationId: string, reason: string): Promise<MutationResult> {
  return mutate("mark_incompatible", participationId, reason);
}
export async function abandonParticipation(participationId: string, reason?: string | null): Promise<MutationResult> {
  return mutate("abandon_participation", participationId, reason);
}
