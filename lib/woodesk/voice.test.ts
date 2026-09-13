import { describe, expect, it } from "vitest";
import { assertVoiceCallTransition, canStartVoiceOutbound } from "./voice";
import { createHttpVoiceProvider } from "./voice-worker";

describe("voice call contract", () => {
  it("allows only forward lifecycle transitions", () => {
    expect(() => assertVoiceCallTransition("queued", "connecting")).not.toThrow();
    expect(() => assertVoiceCallTransition("in_progress", "completed")).not.toThrow();
    expect(() => assertVoiceCallTransition("completed", "in_progress")).toThrow("voice_transition_invalid");
  });

  it("blocks outbound calls before provider execution when policy fails", () => {
    expect(canStartVoiceOutbound({ consented: false, optedOut: false, withinAllowedHours: true, callsToday: 0, dailyLimit: 10 })).toEqual({ allowed: false, reason: "no_consent" });
    expect(canStartVoiceOutbound({ consented: true, optedOut: true, withinAllowedHours: true, callsToday: 0, dailyLimit: 10 })).toEqual({ allowed: false, reason: "opted_out" });
    expect(canStartVoiceOutbound({ consented: true, optedOut: false, withinAllowedHours: true, callsToday: 10, dailyLimit: 10 })).toEqual({ allowed: false, reason: "daily_limit" });
  });

  it("adapts Pipecat/Voicebox-compatible HTTP gateways without persisting credentials", async () => {
    const requests: Request[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      requests.push(new Request(input, init));
      return new Response(JSON.stringify({ externalId: "call-123", status: "connecting" }), { status: 200 });
    };
    const provider = createHttpVoiceProvider({ id: "pipecat", baseUrl: "https://voice.example.test/", bearerToken: "secret", fetchImpl });

    await expect(provider.startCall({ organizationId: "org-1", direction: "outbound" })).resolves.toEqual({ providerId: "pipecat", externalId: "call-123", status: "connecting" });
    expect(requests[0]?.url).toBe("https://voice.example.test/calls");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer secret");
  });

  it("rejects a provider response without an external call id", async () => {
    const fetchImpl = async (): Promise<Response> => new Response(JSON.stringify({ status: "queued" }), { status: 200 });
    const provider = createHttpVoiceProvider({ id: "voicebox", baseUrl: "https://voice.example.test", bearerToken: "secret", fetchImpl });
    await expect(provider.startCall({ organizationId: "org-1", direction: "inbound" })).rejects.toThrow("voice_provider_invalid_receipt");
  });

  it("reports provider health and fails closed on HTTP errors", async () => {
    const provider = createHttpVoiceProvider({
      id: "voicebox",
      baseUrl: "https://voice.example.test",
      bearerToken: "secret",
      fetchImpl: async (_input, init) => init?.method === "POST"
        ? new Response(null, { status: 204 })
        : new Response(null, { status: 503 }),
    });
    await expect(provider.healthCheck()).resolves.toMatchObject({ status: "degraded" });
    await expect(provider.endCall("call/123")).resolves.toBeUndefined();
  });
});
