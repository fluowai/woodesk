import type { NormalizedGoogleBusinessSnapshot } from "./google-business";

export interface GoogleBusinessDb {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

export interface PersistGoogleBusinessSnapshotInput extends NormalizedGoogleBusinessSnapshot {
  organizationId: string;
  locationId: string;
}

/** Persiste um snapshot sem tokens e sem depender de Supabase JS. */
export async function persistGoogleBusinessSnapshot(db: GoogleBusinessDb, input: PersistGoogleBusinessSnapshotInput): Promise<void> {
  await db.query(
    `insert into public.google_business_metrics
      (organization_id, location_id, period_start, period_end, metrics, source)
     values ($1, $2, $3::date, $4::date, $5::jsonb, $6)
     on conflict (location_id, period_start, period_end, source)
     do update set metrics = excluded.metrics, fetched_at = now()
     where public.google_business_metrics.organization_id = $1`,
    [input.organizationId, input.locationId, input.periodStart, input.periodEnd, JSON.stringify(input.metrics), input.source],
  );
  await db.query(
    `update public.google_business_locations
        set last_synced_at = now(), status = 'active'
      where id = $1 and organization_id = $2`,
    [input.locationId, input.organizationId],
  );
}
