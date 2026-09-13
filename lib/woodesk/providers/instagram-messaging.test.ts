import { describe, expect, it, vi } from "vitest";

import { sendInstagramDirectMessage } from "./instagram-messaging";

describe("Instagram messaging provider", () => {
  it("envia bearer apenas no header e devolve o message id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message_id: "mid-1" }), { status: 200 }));
    await expect(sendInstagramDirectMessage({ accessToken: "secret", instagramBusinessAccountId: "business", recipientInstagramId: "person", text: "Olá", fetchImpl })).resolves.toEqual({ externalId: "mid-1" });
    expect(fetchImpl.mock.calls[0]?.[0]).not.toContain("secret");
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: "Bearer secret" });
  });

  it("falha fechado quando o provider não retorna id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "190" } }), { status: 400 }));
    await expect(sendInstagramDirectMessage({ accessToken: "secret", instagramBusinessAccountId: "business", recipientInstagramId: "person", text: "Olá", fetchImpl })).rejects.toThrow("instagram_messaging_failed:400:190");
  });
});
