/**
 * Contratos agnósticos para as capacidades do Woodesk Growth OS.
 *
 * Este módulo não executa integrações externas. Ele define a fronteira para que
 * a aplicação conheça uma capability, e não a biblioteca ou API que a fornece.
 * Providers concretos devem ser registrados por composição no serviço que os usa.
 */

export const WOODESK_CAPABILITIES = [
  "lead_search",
  "lead_enrichment",
  "lead_scoring",
  "local_seo",
  "google_business_metrics",
  "local_rank_tracking",
  "local_geo_grid",
  "competitor_analysis",
  "content_generation",
  "campaign_execution",
  "voice_conversation",
  "instagram_messaging",
  "process_search",
  "google_business",
  "voice_ai",
  "agent_orchestrator",
  "omnichannel",
  "sales_proposals",
  "instagram_studio",
  "marketing_calendar",
  "analytics",
] as const;

export type WoodeskCapability = (typeof WOODESK_CAPABILITIES)[number];

export type ProviderStatus = "healthy" | "degraded" | "unavailable" | "disabled";

export interface ProviderHealth {
  providerId: string;
  status: ProviderStatus;
  checkedAt: Date;
  latencyMs?: number;
  message?: string;
}

export interface WoodeskProvider {
  readonly id: string;
  readonly capabilities: readonly WoodeskCapability[];
  readonly priority: number;
  readonly enabled: boolean;
  healthCheck(): Promise<ProviderHealth>;
}

export interface CapabilityResolution {
  capability: WoodeskCapability;
  providers: readonly WoodeskProvider[];
}

export class WoodeskCapabilityRegistry {
  private readonly providers: readonly WoodeskProvider[];

  constructor(providers: readonly WoodeskProvider[] = []) {
    const ids = new Set<string>();
    for (const provider of providers) {
      if (ids.has(provider.id)) {
        throw new Error(`provider_id_duplicado: ${provider.id}`);
      }
      ids.add(provider.id);
    }
    this.providers = [...providers];
  }

  resolve(capability: WoodeskCapability): CapabilityResolution {
    const providers = this.providers
      .filter((provider) => provider.enabled && provider.capabilities.includes(capability))
      .sort((left, right) => right.priority - left.priority);
    return { capability, providers };
  }

  hasEnabledProvider(id: string, capability: WoodeskCapability): boolean {
    return this.resolve(capability).providers.some((provider) => provider.id === id);
  }

  list(): readonly WoodeskProvider[] {
    return this.providers;
  }
}

export function isWoodeskCapability(value: string): value is WoodeskCapability {
  return (WOODESK_CAPABILITIES as readonly string[]).includes(value);
}
