import { describe, expect, it, vi } from "vitest";
import { createInstagramReplyHandler } from "./reply-worker";

vi.mock("./reply", () => ({ sendInstagramReply: vi.fn().mockResolvedValue({ messageId: "external-1" }) }));

describe("worker de resposta Instagram", () => {
  it("registra consumo idempotente depois do envio", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    await createInstagramReplyHandler()({ id: "job-1", organization_id: "org-1", payload: { conversation_id: "conversation-1", text: "Olá" } } as never, { query } as never);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("instagram_messaging");
    expect(query.mock.calls[0]?.[1]?.[1]).toBe("instagram-reply:job-1");
  });
});
