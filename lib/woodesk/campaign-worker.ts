import type pg from "pg";

import type { JobHandlerContext } from "@/workers/agent-worker/main";
import type { JobRow } from "@/lib/agent-engine/queue/queue";

export interface CampaignDeliveryRequest {
  organizationId: string;
  campaignId: string;
  channel: string;
  audienceFilter: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface CampaignDeliveryProvider {
  readonly id: string;
  readonly enabled: boolean;
  deliver(request: CampaignDeliveryRequest): Promise<{ externalId?: string }>;
  healthCheck(): Promise<{ status: "healthy" | "degraded" | "unavailable" }>;
}

export interface HttpCampaignDeliveryProviderConfig {
  id: string;
  baseUrl: string;
  bearerToken: string;
  fetchImpl?: typeof fetch;
}

export function createHttpCampaignDeliveryProvider(config: HttpCampaignDeliveryProviderConfig): CampaignDeliveryProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const headers = { authorization: `Bearer ${config.bearerToken}`, "content-type": "application/json" };
  return {
    id: config.id,
    enabled: Boolean(baseUrl && config.bearerToken),
    async deliver(request) {
      const response = await fetchImpl(`${baseUrl}/campaigns/deliver`, { method: "POST", headers, body: JSON.stringify(request) });
      if (!response.ok) throw new Error(`campaign_provider_http_${response.status}`);
      const body = await response.json() as { externalId?: unknown };
      return typeof body.externalId === "string" ? { externalId: body.externalId } : {};
    },
    async healthCheck() {
      try {
        const response = await fetchImpl(`${baseUrl}/health`, { headers });
        return { status: response.ok ? "healthy" as const : "degraded" as const };
      } catch {
        return { status: "unavailable" as const };
      }
    },
  };
}

/**
 * A fila representa a intenção de entrega, mas nenhum canal é tratado como
 * configurado por suposição. Até existir um adapter oficial para o canal, a
 * campanha é encerrada com motivo explícito e não há envio parcial.
 */
export function createCampaignExecutionHandler(provider?: CampaignDeliveryProvider) {
  return async (job: JobRow, pool: pg.Pool, _ctx: JobHandlerContext): Promise<void> => {
    const campaignId = typeof job.payload.campaign_id === "string" ? job.payload.campaign_id : null;
    if (!campaignId) throw new Error("campaign_id_missing");
    const result = await pool.query<{ channel: string; status: string; audience_filter: Record<string, unknown>; settings: Record<string, unknown> }>(
      `select channel, status, audience_filter, settings from marketing_campaigns where id=$1 and organization_id=$2`,
      [campaignId, job.organization_id],
    );
    if (result.rowCount !== 1) throw new Error("campaign_not_found");
    if (result.rows[0]?.status === "archived") return;
    if (provider?.enabled) {
      await pool.query(`update marketing_campaigns set status='running', updated_at=now() where id=$1 and organization_id=$2 and status in ('scheduled','running')`, [campaignId, job.organization_id]);
      try {
        await provider.deliver({ organizationId: job.organization_id, campaignId, channel: result.rows[0]?.channel ?? "unknown", audienceFilter: result.rows[0]?.audience_filter ?? {}, settings: result.rows[0]?.settings ?? {} });
        await pool.query(`update marketing_campaigns set status='completed', updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [campaignId, job.organization_id]);
        return;
      } catch (error) {
        const code = error instanceof Error ? error.message.slice(0, 160) : "campaign_delivery_failed";
        await pool.query(`update marketing_campaigns set status='failed', updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [campaignId, job.organization_id]);
        throw new Error(`campaign_delivery_failed:${code}`);
      }
    }
    await pool.query(
      `update marketing_campaigns
          set status='failed', updated_at=now()
        where id=$1 and organization_id=$2 and status in ('scheduled','running')`,
      [campaignId, job.organization_id],
    );
    throw new Error(`campaign_provider_not_configured:${result.rows[0]?.channel ?? "unknown"}`);
  };
}
