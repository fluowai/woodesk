import type pg from "pg";

import type { JobRow } from "@/lib/agent-engine/queue/queue";
import { logger } from "@/lib/logger";
import { sendInstagramReply } from "./reply";

export function createInstagramReplyHandler() {
  return async (job: JobRow, pool: pg.Pool): Promise<void> => {
    const conversationId = typeof job.payload.conversation_id === "string" ? job.payload.conversation_id : null;
    const text = typeof job.payload.text === "string" ? job.payload.text : "";
    if (!conversationId || !text.trim()) throw new Error("instagram_reply_input_invalid");
    await sendInstagramReply(pool, { organizationId: job.organization_id, conversationId, text });
    try {
      await pool.query(
        `insert into wodesk_usage_events (organization_id, capability, quantity, idempotency_key, metadata)
         values ($1, 'instagram_messaging', 1, $2, $3::jsonb)
         on conflict (organization_id, idempotency_key) do nothing`,
        [job.organization_id, `instagram-reply:${job.id}`, JSON.stringify({ conversation_id: conversationId, source: "instagram_reply_worker" })],
      );
    } catch (error) {
      logger.warn("[woodesk] instagram reply usage event failed after delivery", {
        organization_id: job.organization_id,
        job_id: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
