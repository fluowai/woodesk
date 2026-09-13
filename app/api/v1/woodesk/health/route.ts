import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createBrowserImportProvider } from "@/lib/woodesk/providers/browser-import";
import { createHttpCampaignDeliveryProvider } from "@/lib/woodesk/campaign-worker";
import { createHttpVoiceProvider } from "@/lib/woodesk/voice-worker";
import { WoodeskCapabilityRegistry } from "@/lib/woodesk/capabilities";
import { createClient } from "@/lib/supabase/server";
import { resolveCapabilityHealth } from "@/lib/woodesk/health";

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_health" });
  if (!authz.ok) return authz.response;
  try {
    const registry = new WoodeskCapabilityRegistry([createBrowserImportProvider()]);
    const providers = await Promise.all(registry.list().map(async (provider) => {
      const health = await provider.healthCheck();
      return {
        provider_id: health.providerId,
        status: health.status,
        enabled: provider.enabled,
        capabilities: provider.capabilities,
        checked_at: health.checkedAt.toISOString(),
        latency_ms: health.latencyMs ?? null,
        message: health.message ?? null,
      };
    }));
    const supabase = await createClient();
  const { data: flags, error: flagsError } = await supabase.from("feature_flags").select("key, enabled").eq("organization_id", authz.org.orgId).in("key", ["lead_finder", "local_seo", "google_business", "voice_ai", "instagram_studio", "marketing_calendar", "agent_orchestrator", "omnichannel", "sales_proposals", "analytics"]);
    if (flagsError) return fail("internal_error", "Não foi possível consultar as capacidades habilitadas.", 500, { requestId });
    const { count: activeLocations, error: locationsError } = await supabase.from("google_business_locations").select("id", { count: "exact", head: true }).eq("organization_id", authz.org.orgId).eq("status", "active");
    if (locationsError) return fail("internal_error", "Não foi possível consultar o estado dos provedores.", 500, { requestId });
    const { count: activeInstagramSessions, error: instagramSessionError } = await supabase.from("channel_sessions").select("id", { count: "exact", head: true }).eq("organization_id", authz.org.orgId).eq("provider", "instagram_graph").eq("status", "WORKING").is("archived_at", null);
    if (instagramSessionError) return fail("internal_error", "Não foi possível consultar o estado do Instagram.", 500, { requestId });
    const enabled = new Set<string>((flags ?? []).filter((flag) => flag.enabled).map((flag) => flag.key));
    const placesReady = false;
    const voiceProviderId = process.env.VOICE_PROVIDER;
    const voiceProvider = voiceProviderId && (voiceProviderId === "pipecat" || voiceProviderId === "voicebox") && process.env.VOICE_PROVIDER_BASE_URL && process.env.VOICE_PROVIDER_TOKEN
      ? createHttpVoiceProvider({ id: voiceProviderId, baseUrl: process.env.VOICE_PROVIDER_BASE_URL, bearerToken: process.env.VOICE_PROVIDER_TOKEN })
      : null;
    const campaignProvider = process.env.CAMPAIGN_PROVIDER_ID && process.env.CAMPAIGN_PROVIDER_BASE_URL && process.env.CAMPAIGN_PROVIDER_TOKEN
      ? createHttpCampaignDeliveryProvider({ id: process.env.CAMPAIGN_PROVIDER_ID, baseUrl: process.env.CAMPAIGN_PROVIDER_BASE_URL, bearerToken: process.env.CAMPAIGN_PROVIDER_TOKEN })
      : null;
    const [voiceHealth, campaignHealth] = await Promise.all([
      voiceProvider?.healthCheck() ?? Promise.resolve(null),
      campaignProvider?.healthCheck() ?? Promise.resolve(null),
    ]);
    const capabilityStatus = resolveCapabilityHealth({ enabledFlags: enabled, placesReady, activeGoogleBusinessLocations: activeLocations ?? 0 });
    return ok({ organization_id: authz.org.orgId, providers, capabilities: {
      ...capabilityStatus,
      google_business: { enabled: enabled.has("google_business"), configured: (activeLocations ?? 0) > 0, status: !enabled.has("google_business") ? "disabled" : (activeLocations ?? 0) > 0 ? "ready" : "not_configured" },
      voice_ai: { enabled: enabled.has("voice_ai"), configured: Boolean(voiceProvider), provider_status: voiceHealth?.status ?? "unconfigured", status: !enabled.has("voice_ai") ? "disabled" : voiceHealth?.status === "healthy" ? "ready" : voiceProvider ? "provider_unavailable" : "provider_pending" },
      marketing: { enabled: enabled.has("marketing_calendar"), configured: Boolean(campaignProvider), provider_status: campaignHealth?.status ?? "unconfigured", status: !enabled.has("marketing_calendar") ? "disabled" : campaignHealth?.status === "healthy" ? "ready" : campaignProvider ? "provider_unavailable" : "provider_pending" },
      instagram: { enabled: enabled.has("instagram_studio"), configured: (activeInstagramSessions ?? 0) > 0, status: !enabled.has("instagram_studio") ? "disabled" : (activeInstagramSessions ?? 0) > 0 ? "ready" : "not_configured" },
      instagram_messaging: { enabled: enabled.has("instagram_studio"), configured: (activeInstagramSessions ?? 0) > 0, status: !enabled.has("instagram_studio") ? "disabled" : (activeInstagramSessions ?? 0) > 0 ? "ready" : "not_configured" },
      agent_orchestrator: { enabled: enabled.has("agent_orchestrator"), status: enabled.has("agent_orchestrator") ? "partial" : "disabled" },
      omnichannel: { enabled: enabled.has("omnichannel"), status: enabled.has("omnichannel") ? "ready" : "disabled" },
      analytics: { enabled: enabled.has("analytics"), status: enabled.has("analytics") ? "ready" : "disabled" },
    } }, { requestId });
  } catch (error) {
    return fail("internal_error", "Verificação de saúde indisponível.", 500, { requestId });
  }
}
