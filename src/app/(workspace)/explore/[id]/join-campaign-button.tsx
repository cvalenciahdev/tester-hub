"use client";

import { useState, useTransition } from "react";
import { PendingButtonContent } from "@/components/loading-state";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui";
import { T, type TranslationKey } from "@/lib/i18n";
import type { ExploreCampaignDetail, OwnParticipationStatus } from "@/lib/explore";
import { joinExploreCampaign, type JoinResult } from "./actions";

const participationBadgeLabels: Record<OwnParticipationStatus, "Waiting access" | "Access enabled" | "Active" | "Completed" | "Incompatible" | "Abandoned" | "Cancelled"> = {
  waiting_access: "Waiting access", access_enabled: "Access enabled", active: "Active",
  completed: "Completed", incompatible: "Incompatible", abandoned: "Abandoned", cancelled: "Cancelled",
};
const joinErrors: Record<NonNullable<JoinResult["error"]>, TranslationKey> = {
  ALREADY_JOINED: "detail.alreadyJoined", NO_AVAILABLE_SLOTS: "detail.noSlots",
  OWNER_CANNOT_JOIN: "detail.ownerCannotJoin", TESTING_EMAIL_REQUIRED: "detail.testingEmailRequired",
  CAMPAIGN_NOT_OPEN: "detail.campaignNotOpen", CAMPAIGN_NOT_AVAILABLE: "detail.notAvailable",
  JOIN_FAILED: "detail.joinFailed",
  COUNTRY_NOT_ELIGIBLE: "countries.notEligible",
};

export function JoinCampaignButton({ campaignId, availableSlots, participation }: {
  campaignId: string;
  availableSlots: number;
  participation: ExploreCampaignDetail["own_participation"];
}) {
  const [result, setResult] = useState<JoinResult>({});
  const [pending, startTransition] = useTransition();
  const canJoin = participation === null && availableSlots > 0;
  const label = pending ? "detail.joining" : "detail.joinTest";
  return (
    <>
      {participation
        ? <p className="join-footnote"><T id="detail.ownParticipation" /><Badge status={participationBadgeLabels[participation.status]} /></p>
        : canJoin
          ? <button className="button button-primary button-full" type="button" disabled={pending}
              onClick={() => startTransition(async () => {
                try { setResult(await joinExploreCampaign(campaignId)); }
                catch { setResult({ error: "JOIN_FAILED" }); }
              })}>
              <PendingButtonContent pending={pending} label="detail.joining"><T id={label} /><ArrowRight size={16} /></PendingButtonContent>
            </button>
          : <p className="join-footnote"><T id="detail.noSlots" /></p>}
      {result.error && <p className="join-footnote" role="alert"><T id={joinErrors[result.error]} /></p>}
    </>
  );
}
