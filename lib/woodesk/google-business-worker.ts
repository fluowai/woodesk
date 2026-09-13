import type pg from "pg";

import type { JobHandlerContext } from "@/workers/agent-worker/main";
import type { JobRow } from "@/lib/agent-engine/queue/queue";
import { fetchGoogleBusinessMetrics } from "./google-business";
import { persistGoogleBusinessSnapshot } from "./google-business-sync";

export function createGoogleBusinessSyncHandler() {
  return async (job: JobRow, pool: pg.Pool, _ctx: JobHandlerContext): Promise<void> => {
    const locationId = typeof job.payload.location_id === "string" ? job.payload.location_id : null;
    if (!locationId) throw new Error("google_business_location_id_missing");
    const location = await pool.query<{ resource_name: string; connection_id: string; encrypted_token: string | null }>(
      `select l.resource_name, l.connection_id, c.oauth_access_token_encrypted as encrypted_token
         from google_business_locations l
         join calendar_connections c on c.id=l.connection_id and c.organization_id=l.organization_id
         where l.id=$1 and l.organization_id=$2 and l.status <> 'paused' and c.status <> 'token_expired'`,
      [locationId, job.organization_id],
    );
    if (location.rowCount !== 1 || !location.rows[0]) throw new Error("google_business_location_not_found");
    const encrypted = location.rows[0].encrypted_token;
    if (!encrypted) throw new Error("google_business_oauth_missing");
    const tokenResult = await pool.query<{ token: string }>("select public.fn_decrypt_oauth($1) as token", [encrypted]);
    const accessToken = tokenResult.rows[0]?.token;
    if (!accessToken) throw new Error("google_business_oauth_unreadable");
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const snapshot = await fetchGoogleBusinessMetrics({ accessToken, locationResourceName: location.rows[0].resource_name, periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) });
    await persistGoogleBusinessSnapshot({ query: async <T extends Record<string, unknown>>(sql: string, values?: unknown[]) => {
      const result = await pool.query<T>(sql, values);
      return { rows: result.rows };
    } }, { ...snapshot, organizationId: job.organization_id, locationId });
  };
}
