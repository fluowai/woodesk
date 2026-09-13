export interface WoodeskDashboardInput {
  leadsFound: number;
  meetingsScheduled: number;
  opportunities: number;
  salesCents: number;
  contentsGenerated: number;
  voiceCalls: number;
  previous: Partial<WoodeskDashboardInput>;
}

export interface DashboardMetric {
  value: number;
  previousValue: number;
  changePercent: number | null;
}

export interface WoodeskDashboardMetrics {
  leadsFound: DashboardMetric;
  meetingsScheduled: DashboardMetric;
  opportunities: DashboardMetric;
  salesCents: DashboardMetric;
  contentsGenerated: DashboardMetric;
  voiceCalls: DashboardMetric;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function metric(value: number, previousValue: number): DashboardMetric {
  const current = nonNegative(value);
  const previous = nonNegative(previousValue);
  return {
    value: current,
    previousValue: previous,
    changePercent: previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100,
  };
}

export function buildWoodeskDashboardMetrics(input: WoodeskDashboardInput): WoodeskDashboardMetrics {
  return {
    leadsFound: metric(input.leadsFound, input.previous.leadsFound ?? 0),
    meetingsScheduled: metric(input.meetingsScheduled, input.previous.meetingsScheduled ?? 0),
    opportunities: metric(input.opportunities, input.previous.opportunities ?? 0),
    salesCents: metric(input.salesCents, input.previous.salesCents ?? 0),
    contentsGenerated: metric(input.contentsGenerated, input.previous.contentsGenerated ?? 0),
    voiceCalls: metric(input.voiceCalls, input.previous.voiceCalls ?? 0),
  };
}
