export type UsageAnalyticsRow = { capability: string | null; quantity: number | string | null; created_at: string };

export function aggregateUsageAnalytics(rows: readonly UsageAnalyticsRow[]) {
  const byCapability: Record<string, number> = {};
  const byDay: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const capability = row.capability?.trim() || "unknown";
    const parsed = typeof row.quantity === "number" ? row.quantity : Number(row.quantity ?? 0);
    const quantity = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    const day = row.created_at.slice(0, 10);
    byCapability[capability] = (byCapability[capability] ?? 0) + quantity;
    byDay[day] ??= {};
    byDay[day][capability] = (byDay[day][capability] ?? 0) + quantity;
  }
  return { total: Object.values(byCapability).reduce((sum, value) => sum + value, 0), byCapability, byDay };
}
