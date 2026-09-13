import type pg from "pg";

import { resolveInstagramContact } from "./contact";
import type { InstagramWebhookEvent } from "./webhook";

export type InstagramIngestResult = { status: "ingested"; messageId: string; conversationId: string } | { status: "duplicate" };

export async function ingestInstagramInbound(
  pool: pg.Pool,
  input: { organizationId: string; channelSessionId: string; event: InstagramWebhookEvent; senderName?: string | null },
): Promise<InstagramIngestResult> {
  const contactId = await resolveInstagramContact(pool, { organizationId: input.organizationId, senderId: input.event.senderId, name: input.senderName });
  const conversation = await pool.query<{ id: string }>(
    `select id from conversations where organization_id=$1 and channel_session_id=$2 and contact_id=$3 and is_group=false limit 1`,
    [input.organizationId, input.channelSessionId, contactId],
  );
  let conversationId = conversation.rows[0]?.id;
  if (!conversationId) {
    const created = await pool.query<{ id: string }>(
      `insert into conversations (organization_id, channel_session_id, contact_id, channel, provider_conversation_id, is_group, status)
       values ($1, $2, $3, 'instagram', $4, false, 'open') returning id`,
      [input.organizationId, input.channelSessionId, contactId, input.event.senderId],
    );
    conversationId = created.rows[0]?.id;
  }
  if (!conversationId) throw new Error("instagram_conversation_persist_failed");

  try {
    const message = await pool.query<{ id: string }>(
      `insert into messages (organization_id, conversation_id, channel_session_id, contact_id, direction, type, body, external_id, sent_at, status, sent_via, metadata)
       values ($1, $2, $3, $4, 'inbound', 'text', $5, $6, $7, 'delivered', 'instagram_graph', $8::jsonb)
       returning id`,
      [input.organizationId, conversationId, input.channelSessionId, contactId, input.event.text, input.event.messageId, input.event.timestamp.toISOString(), JSON.stringify({ provider: "instagram_graph", kind: input.event.kind, sender_id: input.event.senderId, recipient_id: input.event.recipientId })],
    );
    const messageId = message.rows[0]?.id;
    if (!messageId) throw new Error("instagram_message_persist_failed");
    await pool.query(
      `update conversations set last_inbound_at=$4, last_message_at=$4, last_message_preview=$5, unread_count_for_assignee=unread_count_for_assignee+1, updated_at=now() where id=$1 and organization_id=$2 and channel_session_id=$3`,
      [conversationId, input.organizationId, input.channelSessionId, input.event.timestamp.toISOString(), input.event.text?.slice(0, 120) ?? "[mensagem Instagram]"],
    );
    return { status: "ingested", messageId, conversationId };
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") return { status: "duplicate" };
    throw error;
  }
}
