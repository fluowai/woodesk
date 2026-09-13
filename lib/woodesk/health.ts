import { WOODESK_PLAN_CAPABILITIES, type WoodeskCapability } from "./plan-catalog";

export type CapabilityHealthStatus = "ready" | "provider_pending" | "not_configured" | "disabled";

export interface CapabilityHealth {
  enabled: boolean;
  status: CapabilityHealthStatus;
}

export function resolveCapabilityHealth(input: {
  enabledFlags: ReadonlySet<string>;
  placesReady: boolean;
  activeGoogleBusinessLocations: number;
}): Record<WoodeskCapability, CapabilityHealth> {
  return Object.fromEntries(WOODESK_PLAN_CAPABILITIES.map((capability) => {
    const featureKey = capability === "lead_search" || capability === "lead_enrichment"
      ? "lead_finder"
      : capability === "content_generation" || capability === "campaign_execution"
        ? "marketing_calendar"
        : capability;
    const enabled = input.enabledFlags.has(featureKey);
    const status: CapabilityHealthStatus = capability === "lead_search"
      ? enabled && input.placesReady ? "ready" : enabled ? "provider_pending" : "disabled"
      : capability === "google_business"
        ? enabled && input.activeGoogleBusinessLocations > 0 ? "ready" : enabled ? "not_configured" : "disabled"
        : capability === "omnichannel" || capability === "sales_proposals"
          ? enabled ? "ready" : "disabled"
          : enabled ? "provider_pending" : "disabled";
    return [capability, { enabled, status }];
  })) as Record<WoodeskCapability, CapabilityHealth>;
}
