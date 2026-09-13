import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contrato da superfície de custo de IA", () => {
  it("mantém flag, escopo tenant e fonte canônica llm_calls", () => {
    const source = readFileSync(join(process.cwd(), "app/api/v1/woodesk/ai-costs/route.ts"), "utf8");
    expect(source).toContain('eq("key", "analytics")');
    expect(source).toContain('eq("organization_id", authz.org.orgId)');
    expect(source).toContain('from("llm_calls"');
    expect(source).toContain("aggregateAiCosts");
  });

  it("mantém a migration que vincula custo à conversa sem exigir backfill inventado", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260913200000_0258_woodesk_llm_conversation_cost.sql"), "utf8");
    expect(migration).toContain("add column if not exists conversation_id uuid");
    expect(migration).toContain("on delete set null");
    expect(migration).toContain("where conversation_id is not null");
  });
});
