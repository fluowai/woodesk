import { describe, expect, it, vi } from "vitest";

import { sendInstagramReply } from "./reply";

describe("sendInstagramReply", () => {
  it("resolve o alvo, envia fora do request e registra outbound", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ conversation_id: "conv-1", contact_id: "contact-1", channel_session_id: "session-1", instagram_business_account_id: "business-1", recipient_instagram_id: "person-1", access_token: "secret" }] })
      .mockResolvedValueOnce({ rows: [{ id: "message-1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const send = vi.fn().mockResolvedValue({ externalId: "mid-1" });
    await expect(sendInstagramReply({ query } as never, { organizationId: "org-1", conversationId: "conv-1", text: "Olá", send })).resolves.toEqual({ messageId: "message-1", externalId: "mid-1" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "secret", recipientInstagramId: "person-1" }));
    expect(query.mock.calls[1]?.[0]).toContain("insert into messages");
  });
});
