import { afterEach, describe, expect, it, vi } from "vitest";

import { exchangeInstagramCode, instagramAuthorizeUrl, issueInstagramState, verifyInstagramState } from "@/lib/woodesk/instagram/oauth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Instagram OAuth", () => {
  it("builds an authorization URL with state and redirect, without the app secret", () => {
    vi.stubEnv("META_APP_ID", "app-id");
    vi.stubEnv("META_APP_SECRET", "app-secret");
    vi.stubEnv("META_GRAPH_VERSION", "v22.0");

    const state = issueInstagramState("org-1", { userId: "user-1", authSessionId: "session-1" });
    const url = new URL(instagramAuthorizeUrl({ state, redirectUri: "https://crm.example/api/v1/woodesk/instagram/callback" }));

    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe("/v22.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("app-id");
    expect(url.searchParams.get("redirect_uri")).toContain("/instagram/callback");
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("scope")).toContain("instagram_manage_messages");
    expect(url.toString()).not.toContain("app-secret");
    expect(verifyInstagramState(state)).toMatchObject({ orgId: "org-1", userId: "user-1", authSessionId: "session-1" });
  });

  it("exchanges the code by POST body, never by query string", async () => {
    vi.stubEnv("META_APP_ID", "app-id");
    vi.stubEnv("META_APP_SECRET", "app-secret");
    vi.stubEnv("META_GRAPH_VERSION", "v22.0");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ access_token: "opaque-token", expires_in: 3600 }), { status: 200 }));

    const result = await exchangeInstagramCode({ code: "one-time-code", redirectUri: "https://crm.example/callback" });

    expect(result).toEqual({ accessToken: "opaque-token", expiresIn: 3600 });
    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe("https://graph.facebook.com/v22.0/oauth/access_token");
    expect(String(requestUrl)).not.toContain("app-secret");
    expect(String((init as RequestInit).body)).toContain("client_secret=app-secret");
  });
});
