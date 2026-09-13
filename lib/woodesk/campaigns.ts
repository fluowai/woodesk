export type CampaignChannel = "whatsapp" | "instagram" | "email" | "sms" | "voice";

export type CampaignStatus =
  | "draft"
  | "review"
  | "approved"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "archived";

export interface CampaignDraftInput {
  organizationId: string;
  name: string;
  objective: string;
  channel: CampaignChannel;
  audienceFilter?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  startsAt?: string;
  endsAt?: string;
}

export interface CampaignDraft {
  organizationId: string;
  name: string;
  objective: string;
  channel: CampaignChannel;
  status: "draft";
  audienceFilter: Record<string, unknown>;
  settings: Record<string, unknown>;
  startsAt?: string;
  endsAt?: string;
}

export function createCampaignDraft(input: CampaignDraftInput): CampaignDraft {
  const organizationId = input.organizationId.trim();
  const name = input.name.trim();
  const objective = input.objective.trim();

  if (!organizationId || !name || !objective) {
    throw new Error("campaign_required_fields");
  }
  if (input.endsAt && input.startsAt && input.endsAt < input.startsAt) {
    throw new Error("campaign_invalid_period");
  }

  return {
    organizationId,
    name,
    objective,
    channel: input.channel,
    status: "draft",
    audienceFilter: input.audienceFilter ?? {},
    settings: input.settings ?? {},
    ...(input.startsAt ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt ? { endsAt: input.endsAt } : {}),
  };
}

export function canTransitionCampaign(
  from: CampaignStatus,
  to: CampaignStatus,
): boolean {
  if (from === to) return true;
  const transitions: Record<CampaignStatus, readonly CampaignStatus[]> = {
    draft: ["review", "archived"],
    review: ["draft", "approved", "archived"],
    approved: ["scheduled", "paused", "archived"],
    scheduled: ["running", "paused", "archived"],
    running: ["paused", "completed", "failed"],
    paused: ["scheduled", "running", "archived"],
    completed: ["archived"],
    failed: ["draft", "archived"],
    archived: [],
  };
  return transitions[from].includes(to);
}
