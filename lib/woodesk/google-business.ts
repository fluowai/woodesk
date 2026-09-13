export interface GoogleBusinessMetrics {
  mapsDesktopImpressions: number;
  mapsMobileImpressions: number;
  searchDesktopImpressions: number;
  searchMobileImpressions: number;
  phoneClicks: number;
  websiteClicks: number;
  directionRequests: number;
  messages: number;
}

export interface NormalizedGoogleBusinessSnapshot {
  locationResourceName: string;
  periodStart: string;
  periodEnd: string;
  metrics: GoogleBusinessMetrics;
  source: "google_business_profile_performance";
}

export interface GoogleBusinessMetricsRequest {
  accessToken: string;
  locationResourceName: string;
  periodStart: string;
  periodEnd: string;
  fetchImpl?: typeof fetch;
}

const METRIC_QUERY_MAP = {
  mapsDesktopImpressions: "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  mapsMobileImpressions: "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  searchDesktopImpressions: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  searchMobileImpressions: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  phoneClicks: "CALL_CLICKS",
  websiteClicks: "WEBSITE_CLICKS",
  directionRequests: "BUSINESS_DIRECTION_REQUESTS",
  messages: "BUSINESS_CONVERSATIONS",
} as const;

type RawGoogleResponse = {
  multiDailyMetricTimeSeries?: Array<{ dailyMetricTimeSeries?: Array<{ dailyMetric?: string; timeSeries?: { datedValues?: Array<{ value?: string | number }> } }> }>;
};

/** Adapter REST oficial; não conhece Supabase nem grava dados. */
export async function fetchGoogleBusinessMetrics(request: GoogleBusinessMetricsRequest): Promise<NormalizedGoogleBusinessSnapshot> {
  const fetcher = request.fetchImpl ?? fetch;
  const parsedLocation = request.locationResourceName.match(/^locations\/[^/]+$/);
  if (!parsedLocation) throw new Error("google_business_location_invalid");
  const start = new Date(`${request.periodStart}T00:00:00Z`);
  const end = new Date(`${request.periodEnd}T00:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) throw new Error("google_business_period_invalid");
  const params = new URLSearchParams();
  for (const metric of Object.values(METRIC_QUERY_MAP)) params.append("dailyMetrics", metric);
  params.set("dailyRange.startDate.year", String(start.getUTCFullYear()));
  params.set("dailyRange.startDate.month", String(start.getUTCMonth() + 1));
  params.set("dailyRange.startDate.day", String(start.getUTCDate()));
  params.set("dailyRange.endDate.year", String(end.getUTCFullYear()));
  params.set("dailyRange.endDate.month", String(end.getUTCMonth() + 1));
  params.set("dailyRange.endDate.day", String(end.getUTCDate()));
  const response = await fetcher(`https://businessprofileperformance.googleapis.com/v1/${request.locationResourceName}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${request.accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`google_business_http_${response.status}`);
  const raw = (await response.json()) as RawGoogleResponse;
  const metrics = Object.fromEntries(Object.keys(METRIC_QUERY_MAP).map((key) => [key, 0])) as unknown as GoogleBusinessMetrics;
  for (const group of raw.multiDailyMetricTimeSeries ?? []) {
    for (const series of group.dailyMetricTimeSeries ?? []) {
      const key = (Object.entries(METRIC_QUERY_MAP).find(([, value]) => value === series.dailyMetric)?.[0]) as keyof GoogleBusinessMetrics | undefined;
      if (!key) continue;
      for (const point of series.timeSeries?.datedValues ?? []) {
        const value = typeof point.value === "number" ? point.value : Number(point.value);
        if (Number.isInteger(value) && value >= 0) metrics[key] += value;
      }
    }
  }
  return normalizeGoogleBusinessSnapshot({ locationResourceName: request.locationResourceName, periodStart: request.periodStart, periodEnd: request.periodEnd, metrics, source: "google_business_profile_performance" });
}

const NON_NEGATIVE_METRICS: readonly (keyof GoogleBusinessMetrics)[] = [
  "mapsDesktopImpressions", "mapsMobileImpressions", "searchDesktopImpressions", "searchMobileImpressions",
  "phoneClicks", "websiteClicks", "directionRequests", "messages",
];

export function normalizeGoogleBusinessSnapshot(input: NormalizedGoogleBusinessSnapshot): NormalizedGoogleBusinessSnapshot {
  if (!input.locationResourceName.startsWith("locations/")) throw new Error("google_business_location_invalid");
  if (input.periodEnd < input.periodStart) throw new Error("google_business_period_invalid");
  for (const key of NON_NEGATIVE_METRICS) {
    const value = input.metrics[key];
    if (!Number.isInteger(value) || value < 0) throw new Error(`google_business_metric_invalid:${key}`);
  }
  return { ...input, source: "google_business_profile_performance" };
}
