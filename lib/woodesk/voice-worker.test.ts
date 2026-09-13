import { describe, expect, it, vi } from "vitest";

import type { JobRow } from "@/lib/agent-engine/queue/queue";
import { createHttpVoiceProvider, createUnavailableVoiceProvider } from "@/lib/woodesk/voice-worker";

const job = { organization_id: "org-1", payload: { call_id: "call-1" } } as unknown as JobRow;

describe("voice worker providers", () => {
  it("sends the bearer token only in the authorization header", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ externalId: "ext-1", status: "connecting" }), { status: 200 }));
    const provider = createHttpVoiceProvider({ id: "pipecat", baseUrl: "https://voice.example/", bearerToken: "secret-token", fetchImpl });

    const receipt = await provider.startCall({ organizationId: job.organization_id, direction: "outbound", metadata: {} });

    expect(receipt).toMatchObject({ providerId: "pipecat", externalId: "ext-1", status: "connecting" });
    expect(fetchImpl).toHaveBeenCalledWith("https://voice.example/calls", expect.objectContaining({
      headers: { authorization: "Bearer secret-token", "content-type": "application/json" },
    }));
    expect(JSON.stringify(fetchImpl.mock.calls[0]?.[0])).not.toContain("secret-token");
  });

  it("fails closed when no voice provider is configured", async () => {
    const provider = createUnavailableVoiceProvider("voicebox");

    await expect(provider.startCall({ organizationId: job.organization_id, direction: "inbound", metadata: {} })).rejects.toThrow("voice_provider_not_configured");
    await expect(provider.healthCheck()).resolves.toMatchObject({ status: "unavailable" });
  });
});
