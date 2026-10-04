"use client";

import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { T, type TranslationKey } from "@/lib/i18n";
import type { ExploreCampaignDetail, OwnParticipationStatus } from "@/lib/explore";
import { joinExploreCampaign, type JoinResult } from "./actions";

const participationLabels: Record<OwnParticipationStatus, TranslationKey> = {
  waiting_access: "status.Waiting access", access_enabled: "status.Access enabled",
  active: "status.Active", completed: "status.Completed", incompatible: "status.Incompatible",
  abandoned: "status.Abandoned", cancelled: "status.Cancelled",
};
const joinErrors: Record<NonNullable<JoinResult["error"]>, TranslationKey> = {
  ALREADY_JOINED: "detail.alreadyJoined", NO_AVAILABLE_SLOTS: "detail.noSlots",
  OWNER_CANNOT_JOIN: "detail.ownerCannotJoin", TESTING_EMAIL_REQUIRED: "detail.testingEmailRequired",
  CAMPAIGN_NOT_OPEN: "detail.campaignNotOpen", CAMPAIGN_NOT_AVAILABLE: "detail.notAvailable",
  JOIN_FAILED: "detail.joinFailed",
};

export function JoinCampaignButton({ campaignId, availableSlots, participation }: {
  campaignId: string;
  availableSlots: number;
  participation: ExploreCampaignDetail["own_participation"];
}) {
  const [result, setResult] = useState<JoinResult>({});
  const [pending, startTransition] = useTransition();
  const label = participation ? participationLabels[participation.status]
    : availableSlots === 0 ? "detail.noSlots" : pending ? "detail.joining" : "detail.joinTest";
  return (
    <>
      {participation && <p className="join-footnote"><T id="detail.ownParticipation" />: <T id={participationLabels[participation.status]} /></p>}
      <button className="button button-primary button-full" type="button" disabled={pending || participation !== null || availableSlots === 0}
        onClick={() => startTransition(async () => {
          try { setResult(await joinExploreCampaign(campaignId)); }
          catch { setResult({ error: "JOIN_FAILED" }); }
        })}>
        <T id={label} />{!participation && availableSlots > 0 && <ArrowRight size={16} />}
      </button>
      {result.error && <p className="join-footnote" role="alert"><T id={joinErrors[result.error]} /></p>}
    </>
  );
}
