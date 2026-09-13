import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { parseInstagramWebhook, verifyInstagramWebhookSignature } from "./webhook";

describe("Instagram webhook", () => {
  it("verifica a assinatura HMAC sem aceitar formato inválido", () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const signature = createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifyInstagramWebhookSignature(body, `sha256=${signature}`, "secret")).toBe(true);
    expect(verifyInstagramWebhookSignature(body, "sha256=invalid", "secret")).toBe(false);
  });

  it("normaliza mensagens recebidas e ignora ecos", () => {
    const events = parseInstagramWebhook(JSON.stringify({ entry: [{ messaging: [
      { sender: { id: "sender" }, recipient: { id: "business" }, timestamp: 1720000000000, message: { mid: "m1", text: "Olá" } },
      { sender: { id: "business" }, recipient: { id: "sender" }, timestamp: 1720000000001, message: { mid: "m2", is_echo: true, text: "eco" } },
    ] }] }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ senderId: "sender", recipientId: "business", messageId: "m1", text: "Olá" });
    expect(events[0]?.kind).toBe("message");
  });

  it("normaliza comentários do feed na mesma entrada canônica", () => {
    const events = parseInstagramWebhook(JSON.stringify({ entry: [{ id: "business", changes: [{ field: "comments", value: { id: "comment-1", text: "Posso saber mais?", from: { id: "sender" }, created_time: 1720000000, media: { id: "media-1" } } }] }] }));
    expect(events).toEqual([expect.objectContaining({ kind: "comment", senderId: "sender", recipientId: "business", messageId: "comment-1", text: "Posso saber mais?" })]);
  });

  it("rejeita JSON inválido", () => {
    expect(() => parseInstagramWebhook("não é JSON")).toThrow("instagram_webhook_invalid_json");
  });
});
