import type pg from "pg";
import { z } from "zod";

import type { JobHandlerContext } from "@/workers/agent-worker/main";
import { enqueueJob, type JobRow } from "@/lib/agent-engine/queue/queue";
import { filterLeadResults, scoreLead } from "./lead-finder";
import type { BrowserImportProvider as LeadFinderProvider } from "./providers/browser-import";

const inputSchema = z.object({
  keyword: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(80).optional(),
  limit: z.number().int().min(1).max(100),
  minimum_rating: z.number().min(0).max(5).optional(),
  maximum_rating: z.number().min(0).max(5).optional(),
  minimum_review_count: z.number().int().nonnegative().optional(),
  maximum_review_count: z.number().int().nonnegative().optional(),
  has_website: z.boolean().optional(),
  has_whatsapp: z.boolean().optional(),
  has_instagram: z.boolean().optional(),
});

export function createLeadFinderSearchHandler(provider: LeadFinderProvider) {
  return async (job: JobRow, pool: pg.Pool, _ctx: JobHandlerContext): Promise<void> => {
    const searchId = typeof job.payload.search_id === "string" ? job.payload.search_id : null;
    if (!searchId) throw new Error("lead_finder_search_id_missing");

    const client = await pool.connect();
    try {
      await client.query("begin");
      const search = await client.query<{ query: unknown; status: string }>(
        `select query, status from lead_finder_searches where id=$1 and organization_id=$2 for update`,
        [searchId, job.organization_id],
      );
      if (search.rowCount !== 1) throw new Error("lead_finder_search_not_found");
      if (search.rows[0]?.status === "cancelled") {
        await client.query("rollback");
        return;
      }
      const input = inputSchema.parse(search.rows[0]?.query);
      await client.query(
        `update lead_finder_searches set status='running', started_at=coalesce(started_at, now()), error_code=null where id=$1 and organization_id=$2`,
        [searchId, job.organization_id],
      );

      const results = await provider.search(input);
      const filteredResults = filterLeadResults(results, {
        minimumRating: input.minimum_rating,
        maximumRating: input.maximum_rating,
        minimumReviewCount: input.minimum_review_count,
        maximumReviewCount: input.maximum_review_count,
        hasWebsite: input.has_website,
        hasWhatsapp: input.has_whatsapp,
        hasInstagram: input.has_instagram,
      });
      for (const result of filteredResults) {
        const score = scoreLead({
          hasWebsite: Boolean(result.website),
          rating: result.rating,
          reviewCount: result.reviewCount,
        });
        const inserted = await client.query<{ id: string }>(
          `insert into lead_finder_results
             (organization_id, search_id, external_id, name, category, phone, website,
              address, city, state, rating, review_count, source_url, latitude, longitude,
              normalized_phone, has_whatsapp, raw_data)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           on conflict (organization_id, search_id, external_id) do nothing
           returning id`,
          [
            job.organization_id, searchId, result.externalId, result.name, result.category ?? null,
            result.phone ?? null, result.website ?? null, result.address ?? null, result.city ?? null,
            result.state ?? null, result.rating ?? null, result.reviewCount ?? null, result.sourceUrl ?? null,
            result.latitude ?? null, result.longitude ?? null, result.normalizedPhone, result.hasWhatsapp,
            result,
          ],
        );
        const resultId = inserted.rows[0]?.id;
        if (resultId) {
          await client.query(
            `insert into lead_enrichment
               (result_id, organization_id, status, score, score_band, score_reasons)
             values ($1,$2,'pending',$3,$4,$5)
             on conflict (result_id) do update set score=$3, score_band=$4, score_reasons=$5, updated_at=now()`,
            [resultId, job.organization_id, score.score, score.band, score.reasons],
          );
          await enqueueJob(client, job.organization_id, {
            kind: "lead_enrichment",
            payload: { result_id: resultId },
            maxAttempts: 3,
          });
        }
      }
      await client.query(
        `update lead_finder_searches set status='completed', result_count=$3, finished_at=now(), error_code=null where id=$1 and organization_id=$2`,
        [searchId, job.organization_id, filteredResults.length],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      await client.query(
        `update lead_finder_searches set status='failed', error_code=$3, finished_at=now() where id=$1 and organization_id=$2`,
        [searchId, job.organization_id, error instanceof Error ? error.message.slice(0, 120) : "lead_finder_failed"],
      );
      throw error;
    } finally {
      client.release();
    }
  };
}
