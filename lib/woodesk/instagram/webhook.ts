import { createHmac, timingSafeEqual } from "node:crypto";

export type InstagramWebhookEvent = {
  readonly senderId: string;
  readonly recipientId: string;
  readonly messageId: string;
  readonly text: string | null;
  readonly timestamp: Date;
  readonly kind: "message" | "comment";
};

type RawMessagingEvent = {
  sender?: { id?: unknown };
  recipient?: { id?: unknown };
  timestamp?: unknown;
  message?: { mid?: unknown; text?: unknown; is_echo?: unknown };
};

type RawCommentChange = {
  field?: unknown;
  value?: { id?: unknown; text?: unknown; from?: { id?: unknown }; created_time?: unknown; media?: { id?: unknown } };
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function verifyInstagramWebhookSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const received = header.replace(/^sha256=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

export function parseInstagramWebhook(rawBody: string): InstagramWebhookEvent[] {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error("instagram_webhook_invalid_json");
  }
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { entry?: unknown }).entry)) return [];
  const events: InstagramWebhookEvent[] = [];
  for (const entry of (payload as { entry: unknown[] }).entry) {
    if (!entry || typeof entry !== "object") continue;
    const messaging = (entry as { messaging?: unknown }).messaging;
    if (Array.isArray(messaging)) for (const raw of messaging) {
      const event = raw as RawMessagingEvent;
      const senderId = stringValue(event.sender?.id);
      const recipientId = stringValue(event.recipient?.id);
      const messageId = stringValue(event.message?.mid);
      const timestamp = typeof event.timestamp === "number" ? new Date(event.timestamp) : null;
      if (!senderId || !recipientId || !messageId || !timestamp || Number.isNaN(timestamp.valueOf()) || event.message?.is_echo === true) continue;
      const text = typeof event.message?.text === "string" ? event.message.text : null;
      events.push({ senderId, recipientId, messageId, text, timestamp, kind: "message" });
    }
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const rawChange of changes) {
      const change = rawChange as RawCommentChange;
      if (change.field !== "comments" || !change.value) continue;
      const senderId = stringValue(change.value.from?.id);
      const messageId = stringValue(change.value.id);
      const recipientId = stringValue((entry as { id?: unknown }).id);
      const created = typeof change.value.created_time === "number" ? new Date(change.value.created_time * 1000) : new Date();
      if (!senderId || !messageId || !recipientId || Number.isNaN(created.valueOf())) continue;
      const text = typeof change.value.text === "string" ? change.value.text : null;
      events.push({ senderId, recipientId, messageId, text, timestamp: created, kind: "comment" });
    }
  }
  return events;
}
