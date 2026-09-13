import type pg from "pg";

import type { JobRow } from "@/lib/agent-engine/queue/queue";
import { createBrowserImportProvider } from "@/lib/woodesk/providers/browser-import";

export function createLocalSeoGridHandler(provider = createBrowserImportProvider()) {
  return async (job: JobRow, pool: pg.Pool): Promise<void> => {
    const runId = typeof job.payload.run_id === "string" ? job.payload.run_id : null;
    if (!runId) throw new Error("local_seo_run_id_missing");

    const client = await pool.connect();
    let transactionOpen = false;
    try {
      await client.query("begin");
      transactionOpen = true;
      const runResult = await client.query<{
        organization_id: string;
        keyword_id: string;
        keyword: string;
        target_business_name: string | null;
      }>(
        `select r.organization_id, r.keyword_id, k.keyword, k.target_business_name
           from local_grid_runs r
           join local_keywords k on k.id = r.keyword_id and k.organization_id = r.organization_id
          where r.id = $1 and r.organization_id = $2
          for update`,
        [runId, job.organization_id],
      );
      const run = runResult.rows[0];
      if (!run) throw new Error("local_seo_run_not_found");
      if (!run.target_business_name?.trim()) throw new Error("local_seo_target_business_not_configured");
      if (!provider.enabled) throw new Error("browser_import_required");
      await client.query("update local_grid_runs set status = 'running', started_at = now(), error_code = null where id = $1", [runId]);
      await client.query("commit");
      transactionOpen = false;
      const points = await client.query<{ id: string; latitude: number; longitude: number }>(
        `select id, latitude, longitude from local_grid_points
          where run_id = $1 and organization_id = $2 order by row_index, column_index`,
        [runId, job.organization_id],
      );
      for (const point of points.rows) {
        const results = await provider.search({ keyword: run.keyword, limit: 20, latitude: Number(point.latitude), longitude: Number(point.longitude) });
        const top = results[0];
        await client.query(
          `update local_grid_points
              set position = $3, top_result_name = $4, top_result_url = $5
            where id = $1 and organization_id = $2`,
          [point.id, job.organization_id, null, top?.name ?? null, top?.sourceUrl ?? null],
        );
        if (top) {
          await client.query(
            `insert into local_competitors
              (organization_id, keyword_id, business_name, position, rating, review_count, website, phone, source_url)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [job.organization_id, run.keyword_id, top.name, null, top.rating ?? null, top.reviewCount ?? null, top.website ?? null, top.phone ?? null, top.sourceUrl ?? null],
          );
        }
      }
      await client.query("update local_grid_runs set status = 'completed', finished_at = now() where id = $1", [runId]);
    } catch (error) {
      if (transactionOpen) await client.query("rollback");
      const message = error instanceof Error ? error.message.slice(0, 200) : "local_seo_failed";
      await pool.query("update local_grid_runs set status = 'failed', finished_at = now(), error_code = $3 where id = $1 and organization_id = $2", [runId, job.organization_id, message]);
      throw error;
    } finally {
      client.release();
    }
  };
}
