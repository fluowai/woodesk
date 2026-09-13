import { describe, expect, it } from "vitest";
import { canTransitionCampaign, createCampaignDraft } from "./campaigns";

describe("marketing campaigns", () => {
  it("creates a draft without authorizing delivery", () => {
    expect(createCampaignDraft({
      organizationId: " org-1 ",
      name: " Reativação ",
      objective: "Agendar retorno",
      channel: "whatsapp",
    })).toMatchObject({ organizationId: "org-1", name: "Reativação", status: "draft" });
  });

  it("requires approval before scheduling", () => {
    expect(canTransitionCampaign("draft", "scheduled")).toBe(false);
    expect(canTransitionCampaign("approved", "scheduled")).toBe(true);
  });

  it("rejects an inverted period", () => {
    expect(() => createCampaignDraft({
      organizationId: "org-1",
      name: "Campanha",
      objective: "Objetivo",
      channel: "email",
      startsAt: "2026-09-20T00:00:00Z",
      endsAt: "2026-09-19T00:00:00Z",
    })).toThrow("campaign_invalid_period");
  });
});
