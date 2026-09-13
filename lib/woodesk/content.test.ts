import { describe, expect, it } from "vitest";
import { createContentDraft } from "./content";

describe("marketing content", () => {
  it("creates an approval-required draft with tenant context", () => {
    const draft = createContentDraft({ organizationId: "org-1", channel: "instagram", contentType: "post", businessContext: "clínica", audience: "pacientes", tone: "claro", objective: "agendar" }, "  Conteúdo  ", "  Post  ");
    expect(draft).toMatchObject({ title: "Post", body: "Conteúdo", requiresApproval: true, context: { organizationId: "org-1" } });
  });
});
