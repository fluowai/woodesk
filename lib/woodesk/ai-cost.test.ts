import { describe, expect, it } from "vitest";
import { aggregateAiCosts } from "./ai-cost";

describe("agregação de custos de IA", () => {
  it("agrega tokens e custo por agente, provider e conversa", () => {
    expect(aggregateAiCosts([
      { agent_id: "agent-1", conversation_id: "conversation-1", provider: "openai", input_tokens: 10, output_tokens: 5, cost_cents: 2, created_at: "2026-09-13T00:00:00Z" },
      { agent_id: "agent-1", conversation_id: "conversation-1", provider: "openai", input_tokens: "3", output_tokens: "2", cost_cents: "1", created_at: "2026-09-13T00:01:00Z" },
    ])).toEqual({ tokens: 20, cost_cents: 3, by_agent: { "agent-1": { tokens: 20, cost_cents: 3 } }, by_provider: { openai: { tokens: 20, cost_cents: 3 } }, by_conversation: { "conversation-1": { tokens: 20, cost_cents: 3 } } });
  });
});
