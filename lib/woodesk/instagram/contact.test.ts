import { describe, expect, it, vi } from "vitest";

import { resolveInstagramContact } from "./contact";

describe("resolveInstagramContact", () => {
  it("reutiliza contato ativo pela identidade Instagram", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ id: "contact-1" }] });
    await expect(resolveInstagramContact({ query } as never, { organizationId: "org-1", senderId: "sender-1" })).resolves.toBe("contact-1");
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("cria contato sem preencher identidade WhatsApp", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: "contact-2" }] });
    await expect(resolveInstagramContact({ query } as never, { organizationId: "org-1", senderId: "sender-2", name: "Pessoa" })).resolves.toBe("contact-2");
    expect(query.mock.calls[1]?.[1]).toEqual(["org-1", "ig:sender-2", "Pessoa"]);
  });

  it("resolve a corrida de criação pelo contato vencedor", async () => {
    const conflict = Object.assign(new Error("duplicate"), { code: "23505" });
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(conflict).mockResolvedValueOnce({ rows: [{ id: "winner" }] });
    await expect(resolveInstagramContact({ query } as never, { organizationId: "org-1", senderId: "sender-3" })).resolves.toBe("winner");
    expect(query).toHaveBeenCalledTimes(3);
  });
});
