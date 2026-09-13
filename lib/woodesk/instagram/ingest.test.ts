import { describe, expect, it, vi } from "vitest";

import { ingestInstagramInbound } from "./ingest";

describe("ingestInstagramInbound", () => {
  it("persiste contato, conversa e mensagem no modelo canônico", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "contact-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "conversation-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "message-1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await ingestInstagramInbound({ query } as never, { organizationId: "org-1", channelSessionId: "session-1", event: { senderId: "sender-1", recipientId: "business-1", messageId: "message-external-1", text: "Olá", timestamp: new Date("2026-09-13T12:00:00Z"), kind: "message" } });
    expect(result).toEqual({ status: "ingested", messageId: "message-1", conversationId: "conversation-1" });
    expect(query.mock.calls[4]?.[0]).toContain("insert into messages");
  });
});
