import { WOODESK_CAPABILITIES as REGISTRY_CAPABILITIES, type WoodeskCapability as RegistryCapability } from "./capabilities";

export const WOODESK_PLAN_CAPABILITIES = [
  "lead_search",
  "lead_enrichment",
  "lead_scoring",
  "google_business_metrics",
  "local_seo",
  "local_rank_tracking",
  "local_geo_grid",
  "competitor_analysis",
  "google_business",
  "voice_ai",
  "content_generation",
  "campaign_execution",
  "agent_orchestrator",
  "omnichannel",
  "sales_proposals",
  "instagram_studio",
  "instagram_messaging",
  "marketing_calendar",
  "analytics",
] as const satisfies readonly RegistryCapability[];

export type WoodeskCapability = (typeof WOODESK_PLAN_CAPABILITIES)[number];

export const WOODESK_CAPABILITY_LABELS: Record<WoodeskCapability, string> = {
  lead_search: "Lead Finder",
  lead_enrichment: "Enriquecimento de leads",
  lead_scoring: "Scoring de leads",
  google_business_metrics: "Métricas do Google Business",
  local_seo: "Local SEO / GeoGrid",
  local_rank_tracking: "Rastreamento de ranking local",
  local_geo_grid: "GeoGrid local",
  competitor_analysis: "Análise de concorrentes",
  google_business: "Google Business",
  voice_ai: "Voice AI",
  content_generation: "Geração de conteúdo",
  campaign_execution: "Execução de campanhas",
  agent_orchestrator: "Orquestrador de agentes",
  omnichannel: "Omnichannel",
  sales_proposals: "Propostas comerciais",
  instagram_studio: "Instagram Studio",
  instagram_messaging: "Mensageria Instagram",
  marketing_calendar: "Calendário de marketing",
  analytics: "Analytics operacional",
};

export function isWoodeskCapability(value: string): value is WoodeskCapability {
  return (WOODESK_PLAN_CAPABILITIES as readonly string[]).includes(value);
}

export function isRegistryCapability(value: string): value is RegistryCapability {
  return (REGISTRY_CAPABILITIES as readonly string[]).includes(value);
}
