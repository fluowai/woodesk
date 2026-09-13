import type pg from "pg";

import type { JobHandlerContext } from "@/workers/agent-worker/main";
import type { JobRow } from "@/lib/agent-engine/queue/queue";
import { publishInstagramCarousel, publishInstagramImage, publishInstagramReel, publishInstagramStory } from "@/lib/woodesk/providers/instagram-graph";

export interface ContentPublishProvider {
  readonly id: string;
  readonly enabled: boolean;
  publish(input: { organizationId: string; contentId: string; channel: string; contentType?: string; body: string; media: unknown }): Promise<{ externalId: string }>;
}

function firstHttpsMediaUrl(media: unknown): string | null {
  if (!Array.isArray(media)) return null;
  for (const item of media) {
    const value = typeof item === "string" ? item : item && typeof item === "object" && "url" in item && typeof item.url === "string" ? item.url : null;
    if (value?.startsWith("https://")) return value;
  }
  return null;
}

function httpsMediaUrls(media: unknown): string[] {
  if (!Array.isArray(media)) return [];
  return media.flatMap((item) => {
    const value = typeof item === "string" ? item : item && typeof item === "object" && "url" in item && typeof item.url === "string" ? item.url : null;
    return value?.startsWith("https://") ? [value] : [];
  });
}

/**
 * Composição segura para o worker: o chamador resolve OAuth via
 * `instagram_accounts` + `fn_decrypt_oauth` e entrega somente o segredo em
 * memória ao adapter. O worker não lê nem persiste tokens diretamente.
 */
export async function createInstagramContentProviderFromResolver(
  resolveCredentials: () => Promise<{ accessToken: string; instagramUserId: string } | null>,
  options: { graphVersion?: string; fetchImpl?: typeof fetch } = {},
): Promise<ContentPublishProvider | null> {
  const credentials = await resolveCredentials();
  if (!credentials) return null;
  return createInstagramContentProvider({ ...credentials, ...options });
}

export function createInstagramContentProvider(config: { accessToken: string; instagramUserId: string; graphVersion?: string; fetchImpl?: typeof fetch }): ContentPublishProvider {
  return {
    id: "meta_instagram_graph",
    enabled: Boolean(config.accessToken.trim() && config.instagramUserId.trim()),
    async publish(input) {
      if (input.channel !== "instagram") throw new Error("content_channel_provider_mismatch");
      if (input.contentType && !["post", "carousel", "story", "reel"].includes(input.contentType)) throw new Error(`instagram_content_type_not_supported:${input.contentType}`);
      if (input.contentType === "carousel") {
        const result = await publishInstagramCarousel({ accessToken: config.accessToken, instagramUserId: config.instagramUserId, graphVersion: config.graphVersion, caption: input.body, imageUrls: httpsMediaUrls(input.media), fetchImpl: config.fetchImpl });
        return { externalId: result.mediaId };
      }
      if (input.contentType === "story") {
        const image = firstHttpsMediaUrl(input.media);
        if (!image) throw new Error("instagram_media_url_missing");
        const result = await publishInstagramStory({ accessToken: config.accessToken, instagramUserId: config.instagramUserId, graphVersion: config.graphVersion, caption: input.body, imageUrl: image, fetchImpl: config.fetchImpl });
        return { externalId: result.mediaId };
      }
      if (input.contentType === "reel") {
        const video = firstHttpsMediaUrl(input.media);
        if (!video) throw new Error("instagram_media_url_missing");
        const result = await publishInstagramReel({ accessToken: config.accessToken, instagramUserId: config.instagramUserId, graphVersion: config.graphVersion, caption: input.body, videoUrl: video, fetchImpl: config.fetchImpl });
        return { externalId: result.mediaId };
      }
      const imageUrl = firstHttpsMediaUrl(input.media);
      if (!imageUrl) throw new Error("instagram_media_url_missing");
      const result = await publishInstagramImage({ accessToken: config.accessToken, instagramUserId: config.instagramUserId, graphVersion: config.graphVersion, caption: input.body, imageUrl, fetchImpl: config.fetchImpl });
      return { externalId: result.mediaId };
    },
  };
}

export async function resolveInstagramContentProvider(pool: pg.Pool, organizationId: string, instagramAccountId?: string | null): Promise<ContentPublishProvider | null> {
  const result = await pool.query<{ instagram_business_account_id: string; access_token: string | null }>(
    `select instagram_business_account_id, public.fn_decrypt_oauth(access_token_encrypted) as access_token from instagram_accounts where organization_id=$1 and status='connected' and (token_expires_at is null or token_expires_at > now()) and ($2::text is null or id::text=$2::text) order by updated_at desc limit 1`,
    [organizationId, instagramAccountId ?? null],
  );
  const row = result.rows[0];
  if (!row?.access_token) return null;
  return createInstagramContentProvider({ accessToken: row.access_token, instagramUserId: row.instagram_business_account_id });
}

export function createContentPublishHandler(
  provider?: ContentPublishProvider,
  resolveProvider?: (job: JobRow, pool: pg.Pool, instagramAccountId?: string | null) => Promise<ContentPublishProvider | null>,
) {
  return async (job: JobRow, pool: pg.Pool, _ctx: JobHandlerContext): Promise<void> => {
    const calendarItemId = typeof job.payload.calendar_item_id === "string" ? job.payload.calendar_item_id : null;
    if (!calendarItemId) throw new Error("content_calendar_item_id_missing");
    const item = await pool.query<{ channel: string; content_type?: string; status: string; content_id: string; body: string; media: unknown; instagram_account_id?: string | null }>(
      `select c.channel, c.content_type, i.status, i.content_id, c.body, c.media, c.context->>'instagram_account_id' as instagram_account_id from content_calendar_items i join marketing_contents c on c.id=i.content_id and c.organization_id=i.organization_id where i.id=$1 and i.organization_id=$2`,
      [calendarItemId, job.organization_id],
    );
    if (item.rowCount !== 1 || !item.rows[0]) throw new Error("content_calendar_item_not_found");
    if (item.rows[0].status === "cancelled") return;
    await pool.query(`update content_calendar_items set status='processing' where id=$1 and organization_id=$2 and status='scheduled'`, [calendarItemId, job.organization_id]);
    const activeProvider = provider ?? (resolveProvider ? await resolveProvider(job, pool, item.rows[0].instagram_account_id) : null);
    if (activeProvider?.enabled) {
      try {
        const receipt = await activeProvider.publish({ organizationId: job.organization_id, contentId: item.rows[0].content_id, channel: item.rows[0].channel, contentType: item.rows[0].content_type, body: item.rows[0].body, media: item.rows[0].media });
        await pool.query(`update content_calendar_items set status='published', provider_id=$3, external_id=$4 where id=$1 and organization_id=$2`, [calendarItemId, job.organization_id, activeProvider.id, receipt.externalId]);
        await pool.query(`update marketing_contents set status='published', published_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status in ('scheduled','approved')`, [item.rows[0].content_id, job.organization_id]);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 200) : "content_publish_failed";
        await pool.query(`update content_calendar_items set status='failed', error_code=$3 where id=$1 and organization_id=$2`, [calendarItemId, job.organization_id, message]);
        await pool.query(`update marketing_contents set status='failed', updated_at=now() where id=$1 and organization_id=$2 and status in ('scheduled','approved')`, [item.rows[0].content_id, job.organization_id]);
        throw error;
      }
    }
    await pool.query(`update content_calendar_items set status='failed', error_code=$3 where id=$1 and organization_id=$2`, [calendarItemId, job.organization_id, `provider_not_configured:${item.rows[0].channel}`]);
    await pool.query(`update marketing_contents set status='failed', updated_at=now() where id=$1 and organization_id=$2 and status='scheduled'`, [item.rows[0].content_id, job.organization_id]);
    throw new Error(`content_provider_not_configured:${item.rows[0].channel}`);
  };
}
