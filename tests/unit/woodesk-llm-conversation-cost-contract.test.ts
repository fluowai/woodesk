import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("telemetria de custo por conversa", () => {
  it("propaga conversation_id nos inserts de sucesso e falha", () => {
    const source = readFileSync(join(process.cwd(), "lib/agent-engine/edge/llm/run-model-call.ts"), "utf8");
    const inserts = source.match(/insert into llm_calls[\s\S]*?returning id|insert into llm_calls[\s\S]*?\)`/gi) ?? [];
    expect(inserts.length).toBeGreaterThanOrEqual(2);
    for (const insert of inserts) expect(insert).toContain("conversation_id");
    expect(source).toContain("conversationId?: string | null");
  });

  it("propaga o contexto das chamadas inbound", () => {
    const source = readFileSync(join(process.cwd(), "lib/agent-engine/agent/inbound-turn.ts"), "utf8");
    expect(source).toContain("conversationId: input.conversationId");
  });
});
