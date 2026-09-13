import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("contrato de entrega Woodesk", () => {
  it("mantém a documentação obrigatória do prompt", () => {
    for (const name of [
      "ARCHITECTURE.md",
      "MODULES.md",
      "DATABASE.md",
      "AGENTS.md",
      "LOCAL-SEO.md",
      "LEAD-FINDER.md",
      "VOICE.md",
      "INSTAGRAM.md",
      "OMNICHANNEL.md",
      "DEPLOY.md",
      "DELIVERY.md",
    ]) {
      expect(existsSync(join(root, "docs", "woodesk", name)), name).toBe(true);
    }
  });

  it("mantém os providers externos documentados no schema e no template", () => {
    const envSchema = readFileSync(join(root, "lib", "agent-engine", "env.ts"), "utf8");
    const envExample = readFileSync(join(root, ".env.example"), "utf8");
    for (const name of [
      "VOICE_PROVIDER",
      "VOICE_PROVIDER_BASE_URL",
      "VOICE_PROVIDER_TOKEN",
      "CAMPAIGN_PROVIDER_ID",
      "CAMPAIGN_PROVIDER_BASE_URL",
      "CAMPAIGN_PROVIDER_TOKEN",
    ]) {
      expect(envSchema).toContain(name);
      expect(envExample).toContain(name);
    }
  });
});
