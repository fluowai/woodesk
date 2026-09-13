import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES = [
  "app/api/v1/woodesk/health/route.ts",
  "app/api/v1/woodesk/entitlements/route.ts",
  "app/api/v1/woodesk/usage/route.ts",
  "app/api/v1/woodesk/analytics/route.ts",
] as const;

describe("higiene de erros da API Woodesk", () => {
  it("não devolve diretamente mensagens internas em respostas 5xx", () => {
    const root = process.cwd();
    for (const relativePath of ROUTES) {
      const source = readFileSync(join(root, relativePath), "utf8");
      expect(source, relativePath).not.toMatch(/fail\(\s*["']internal_error["'][^\n]*\.message/);
    }
  });
});
