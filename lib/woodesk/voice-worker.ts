import type pg from "pg";

import type { JobRow } from "@/lib/agent-engine/queue/queue";
import { assertVoiceCallTransition, type VoiceProvider } from "@/lib/woodesk/voice";

export interface HttpVoiceProviderConfig {
  id: "pipecat" | "voicebox";
  baseUrl: string;
  bearerToken: string;
  fetchImpl?: typeof fetch;
}

/**
 * Adaptador mínimo para gateways compatíveis com o contrato de voz.
 * Credenciais entram por injeção no worker e nunca são persistidas ou logadas.
 */
export function createHttpVoiceProvider(config: HttpVoiceProviderConfig): VoiceProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const headers = { authorization: `Bearer ${config.bearerToken}`, "content-type": "application/json" };
  return {
    id: config.id,
    enabled: Boolean(baseUrl && config.bearerToken),
    async startCall(request) {
      const response = await fetchImpl(`${baseUrl}/calls`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error(`voice_provider_http_${response.status}`);
      const body = await response.json() as Partial<{ externalId: string; status: string }>;
      if (!body.externalId) throw new Error("voice_provider_invalid_receipt");
      const status = body.status === "in_progress" || body.status === "connecting" ? body.status : "queued";
      return { providerId: config.id, externalId: body.externalId, status };
    },
    async endCall(externalId) {
      const response = await fetchImpl(`${baseUrl}/calls/${encodeURIComponent(externalId)}/end`, { method: "POST", headers });
      if (!response.ok) throw new Error(`voice_provider_http_${response.status}`);
    },
    async healthCheck() {
      const started = Date.now();
      try {
        const response = await fetchImpl(`${baseUrl}/health`, { headers });
        return { status: response.ok ? "healthy" as const : "degraded" as const, latencyMs: Date.now() - started };
      } catch {
        return { status: "unavailable" as const, latencyMs: Date.now() - started };
      }
    },
  };
}

export function createUnavailableVoiceProvider(id: string): VoiceProvider {
  return {
    id,
    enabled: false,
    async startCall(): Promise<never> { throw new Error("voice_provider_not_configured"); },
    async endCall(): Promise<void> { throw new Error("voice_provider_not_configured"); },
    async healthCheck() { return { status: "unavailable" as const }; },
  };
}

export function createVoiceCallHandler(provider: VoiceProvider) {
  return async (job: JobRow, pool: pg.Pool): Promise<void> => {
    const callId = typeof job.payload.call_id === "string" ? job.payload.call_id : null;
    if (!callId) throw new Error("voice_call_id_missing");
    const client = await pool.connect();
    try {
      const result = await client.query<{ id: string; organization_id: string; contact_id: string | null; direction: "inbound" | "outbound"; status: "queued" | "connecting"; metadata: Record<string, unknown> }>(
        `select id, organization_id, contact_id, direction, status, metadata from voice_calls where id = $1 and organization_id = $2 for update`,
        [callId, job.organization_id],
      );
      const call = result.rows[0];
      if (!call) throw new Error("voice_call_not_found");
      if (!provider.enabled) throw new Error("voice_provider_not_configured");
      assertVoiceCallTransition(call.status, "connecting");
      await client.query("update voice_calls set status = 'connecting', updated_at = now() where id = $1 and organization_id = $2", [callId, job.organization_id]);
      const receipt = await provider.startCall({ organizationId: job.organization_id, contactId: call.contact_id ?? undefined, direction: call.direction, metadata: call.metadata });
      await client.query("update voice_calls set provider_id = $3, external_id = $4, status = $5, started_at = now(), updated_at = now() where id = $1 and organization_id = $2", [callId, job.organization_id, receipt.providerId, receipt.externalId, receipt.status]);
    } catch (error) {
      await client.query("update voice_calls set status = 'failed', updated_at = now() where id = $1 and organization_id = $2 and status not in ('completed','cancelled')", [callId, job.organization_id]);
      throw error;
    } finally {
      client.release();
    }
  };
}
