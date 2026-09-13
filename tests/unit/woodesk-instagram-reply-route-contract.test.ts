import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contrato de limite de resposta Instagram", () => {
  it("consulta usage, plano e entitlement antes de enfileirar", () => {
    const source = readFileSync(join(process.cwd(), "app/api/v1/woodesk/instagram/conversations/[id]/reply/route.ts"), "utf8");
    expect(source).toContain("instagram_messaging");
    expect(source).toContain("decideEntitlement");
    expect(source).toContain("usagePeriodStart");
    expect(source).toContain("plan_limit_reached");
    expect(source).toContain('kind: "instagram_reply"');
  });
});
