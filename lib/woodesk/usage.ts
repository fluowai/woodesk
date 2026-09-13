import type { SupabaseClient } from "@supabase/supabase-js";

export interface UsageEventInput {
  organizationId: string;
  capability: string;
  idempotencyKey: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface UsageRow {
  capability: string;
  quantity: number | null;
}

export function aggregateUsage(rows: readonly UsageRow[]): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const row of rows) {
    const quantity = Number.isFinite(row.quantity) ? Math.max(0, row.quantity ?? 0) : 0;
    usage[row.capability] = (usage[row.capability] ?? 0) + quantity;
  }
  return usage;
}

export interface UsageHistoryRow extends UsageRow { period_start: string; }

export function aggregateUsageHistory(rows: readonly UsageHistoryRow[]): Record<string, Record<string, number>> {
  const history: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const bucket = history[row.period_start] ?? (history[row.period_start] = {});
    const quantity = Number.isFinite(row.quantity) ? Math.max(0, row.quantity ?? 0) : 0;
    bucket[row.capability] = (bucket[row.capability] ?? 0) + quantity;
  }
  return history;
}

export function usagePeriodStart(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/** Registro best-effort: telemetria nunca deve bloquear a operação principal. */
export async function recordUsageEvent(db: SupabaseClient, input: UsageEventInput): Promise<boolean> {
  try {
    const table: string = "woodesk_usage_events";
    const { error } = await db.from(table).insert({
      organization_id: input.organizationId,
      capability: input.capability,
      period_start: usagePeriodStart(input.occurredAt),
      quantity: input.quantity ?? 1,
      idempotency_key: input.idempotencyKey,
      metadata: input.metadata ?? {},
      ...(input.occurredAt ? { occurred_at: input.occurredAt.toISOString() } : {}),
    });
    return !error || error.code === "23505";
  } catch {
    return false;
  }
}
