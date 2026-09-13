import type pg from "pg";

import { sendInstagramDirectMessage, type InstagramDirectMessageInput } from "@/lib/woodesk/providers/instagram-messaging";

export async function sendInstagramReply(
  pool: pg.Pool,
  input: { organizationId: string; conversationId: string; text: string; send?: (request: InstagramDirectMessageInput) => Promise<{ externalId: string }> },
): Promise<{ messageId: string; externalId: string }> {
  const row = await pool.query<{
    conversation_id: string;
    contact_id: string;
    channel_session_id: string;
    instagram_business_account_id: string;
    recipient_instagram_id: string;
    access_token: string | null;
  }>(
    `select c.id as conversation_id, c.contact_id, c.channel_session_id,
            ia.instagram_business_account_id,
            substring(co.instagram_identity from 4) as recipient_instagram_id,
            public.fn_decrypt_oauth(ia.access_token_encrypted) as access_token
       from conversations c
       join channel_sessions cs on cs.id=c.channel_session_id and cs.organization_id=c.organization_id
       join instagram_accounts ia on ia.id=cs.instagram_account_id and ia.organization_id=c.organization_id
       join contacts co on co.id=c.contact_id and co.organization_id=c.organization_id
      where c.id=$1 and c.organization_id=$2 and c.channel='instagram'
        and cs.provider='instagram_graph' and cs.archived_at is null
        and ia.status='connected' and co.instagram_identity is not null
      limit 1`,
    [input.conversationId, input.organizationId],
  );
  const target = row.rows[0];
  if (!target?.access_token || !target.recipient_instagram_id) throw new Error("instagram_reply_target_unavailable");
  const send = input.send ?? sendInstagramDirectMessage;
  const sent = await send({ accessToken: target.access_token, instagramBusinessAccountId: target.instagram_business_account_id, recipientInstagramId: target.recipient_instagram_id, text: input.text });
  const created = await pool.query<{ id: string }>(
    `insert into messages (organization_id, conversation_id, channel_session_id, contact_id, direction, type, body, external_id, sent_at, status, sent_via, metadata)
     values ($1, $2, $3, $4, 'outbound', 'text', $5, $6, now(), 'sent', 'instagram_graph', $7::jsonb) returning id`,
    [input.organizationId, target.conversation_id, target.channel_session_id, target.contact_id, input.text.trim(), sent.externalId, JSON.stringify({ provider: "instagram_graph" })],
  );
  const messageId = created.rows[0]?.id;
  if (!messageId) throw new Error("instagram_reply_persist_failed");
  await pool.query(
    `update conversations set last_outbound_at=now(), last_message_at=now(), last_message_preview=$4, updated_at=now() where id=$1 and organization_id=$2 and channel_session_id=$3`,
    [target.conversation_id, input.organizationId, target.channel_session_id, input.text.trim().slice(0, 120)],
  );
  return { messageId, externalId: sent.externalId };
}
