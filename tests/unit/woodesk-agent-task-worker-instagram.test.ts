import { describe, expect, it, vi } from "vitest";
import { createAgentTaskHandler } from "@/lib/woodesk/agent-task-worker";

describe("executor de tarefa Instagram Messaging", () => {
  it("valida a conversa no tenant e enfileira instagram_reply", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "instagram_messaging", input: { conversation_id: "conversation-1", text: "Olá" }, requires_human_approval: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ used: "0" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ plan_id: "plan-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ enabled: true, monthly_limit: 10 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "conversation-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "job-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await createAgentTaskHandler()({ id: "job-agent", organization_id: "org-1", payload: { task_id: "task-1" } } as never, { query } as never);
    expect(query.mock.calls[6]?.[0]).toContain("instagram_reply");
    expect(query.mock.calls[6]?.[1]?.[1]).toContain("conversation-1");
  });
});
