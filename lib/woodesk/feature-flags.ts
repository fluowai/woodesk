export const WOODESK_FEATURE_FLAGS = [
  "lead_finder",
  "local_seo",
  "google_business",
  "voice_ai",
  "instagram_studio",
  "marketing_calendar",
  "omnichannel",
  "sales_proposals",
  "agent_orchestrator",
  "analytics",
] as const;

export type WoodeskFeatureFlag = (typeof WOODESK_FEATURE_FLAGS)[number];

export function isWoodeskFeatureFlag(value: string): value is WoodeskFeatureFlag {
  return (WOODESK_FEATURE_FLAGS as readonly string[]).includes(value);
}

export function featureEnabled(flag: WoodeskFeatureFlag, values: Readonly<Record<string, boolean>>): boolean {
  return values[flag] === true;
}
