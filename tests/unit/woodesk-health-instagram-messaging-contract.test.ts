import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("health da mensageria Instagram", () => {
  it("expõe o estado da capability usando a sessão Graph ativa", () => {
    const source = readFileSync(join(process.cwd(), "app/api/v1/woodesk/health/route.ts"), "utf8");
    expect(source).toContain("instagram_messaging:");
    expect(source).toContain("activeInstagramSessions");
    expect(source).toContain('enabled.has("instagram_studio")');
  });

  it("não confunde configuração com saúde do gateway", () => {
    const source = readFileSync(join(process.cwd(), "app/api/v1/woodesk/health/route.ts"), "utf8");
    expect(source).toContain("voiceProvider?.healthCheck()");
    expect(source).toContain("campaignProvider?.healthCheck()");
    expect(source).toContain('"provider_unavailable"');
    expect(source).toContain('provider_status:');
  });
});
