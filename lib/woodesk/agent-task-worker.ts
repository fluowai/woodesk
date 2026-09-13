import type pg from "pg";

import type { JobRow } from "@/lib/agent-engine/queue/queue";
import { runModelCall, type LlmEdgeConfig } from "@/lib/agent-engine/edge/llm/run-model-call";
import { generateLeadDiagnostic } from "@/lib/woodesk/diagnostic";
import { decideEntitlement } from "@/lib/woodesk/entitlements";
import { usagePeriodStart } from "@/lib/woodesk/usage";

const CONTENT_CHANNELS = new Set(["instagram", "whatsapp", "email", "sms", "voice"]);
const CONTENT_TYPES = new Set(["post", "story", "reel", "carousel", "caption", "script", "email"]);

export function createAgentTaskHandler(llmCfg?: LlmEdgeConfig) {
  return async (job: JobRow, pool: pg.Pool): Promise<void> => {
    const taskId = typeof job.payload.task_id === "string" ? job.payload.task_id : null;
    if (!taskId) throw new Error("agent_task_id_missing");
    const task = await pool.query<{ capability: string; input: Record<string, unknown>; requires_human_approval: boolean }>(
      `select capability, input, requires_human_approval from agent_tasks where id=$1 and organization_id=$2 and status='queued'`,
      [taskId, job.organization_id],
    );
    if (task.rowCount !== 1 || !task.rows[0]) throw new Error("agent_task_not_found");
    if (task.rows[0].requires_human_approval) {
      await pool.query(`update agent_tasks set status='failed', error_code='agent_task_approval_required', finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='queued'`, [taskId, job.organization_id]);
      throw new Error("agent_task_approval_required");
    }
    await pool.query(`update agent_tasks set status='running', started_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='queued'`, [taskId, job.organization_id]);
    try {
      if (task.rows[0].capability === "lead_search") {
        const input = task.rows[0].input;
        const keyword = typeof input.keyword === "string" ? input.keyword.trim() : "";
        const city = typeof input.city === "string" ? input.city.trim() : "";
        const providerId = typeof input.provider_id === "string" ? input.provider_id.trim() : "browser_import";
        const limit = typeof input.limit === "number" && Number.isInteger(input.limit) ? input.limit : 25;
        if (!keyword || keyword.length > 120 || !city || city.length > 120 || limit < 1 || limit > 100) throw new Error("agent_lead_search_input_invalid");
        const usage = await pool.query<{ used: string }>(
          `select coalesce(sum(quantity), 0)::text as used from wodesk_usage_events where organization_id=$1 and capability='lead_search' and period_start=$2`,
          [job.organization_id, usagePeriodStart()],
        );
        const plan = await pool.query<{ plan_id: string | null }>(`select plan_id from organizations where id=$1`, [job.organization_id]);
        const entitlement = await pool.query<{ enabled: boolean; monthly_limit: number | null }>(
          `select enabled, monthly_limit from plan_entitlements where plan_id=$1 and capability='lead_search'`,
          [plan.rows[0]?.plan_id ?? ""],
        );
        const decision = decideEntitlement(entitlement.rows[0] ? { enabled: entitlement.rows[0].enabled, monthlyLimit: entitlement.rows[0].monthly_limit } : null, Number(usage.rows[0]?.used ?? 0));
        if (!decision.allowed) throw new Error(`agent_lead_search_plan_limit:${decision.reason}`);
        const query = { ...input, provider_id: providerId, keyword, city, limit };
        const created = await pool.query<{ id: string }>(
          `insert into lead_finder_searches (organization_id, requested_by, provider_id, query)
           values ($1, null, $2, $3::jsonb) returning id`,
          [job.organization_id, providerId, JSON.stringify(query)],
        );
        const searchId = created.rows[0]?.id;
        if (!searchId) throw new Error("agent_lead_search_persist_failed");
        const queued = await pool.query<{ id: string }>(
          `insert into job_queue (organization_id, kind, payload, priority) values ($1, 'lead_finder_search', $2::jsonb, 50) returning id`,
          [job.organization_id, JSON.stringify({ search_id: searchId, provider_id: providerId })],
        );
        if (!queued.rows[0]?.id) throw new Error("agent_lead_search_queue_failed");
        try {
          await pool.query(
            `insert into wodesk_usage_events (organization_id, capability, quantity, idempotency_key, metadata)
             values ($1, 'lead_search', 1, $2, $3::jsonb)
             on conflict (organization_id, idempotency_key) do nothing`,
            [job.organization_id, `agent-lead-search:${taskId}`, JSON.stringify({ search_id: searchId, source: "agent_task" })],
          );
        } catch {
          // A telemetria não pode transformar uma busca já enfileirada em falha.
        }
        await pool.query(`update agent_tasks set status='completed', result=$3::jsonb, finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [taskId, job.organization_id, JSON.stringify({ search_id: searchId, delegated_job_id: queued.rows[0].id })]);
        return;
      }
      if (task.rows[0].capability === "lead_enrichment") {
        const resultId = typeof task.rows[0].input.result_id === "string" ? task.rows[0].input.result_id : null;
        if (!resultId) throw new Error("agent_lead_enrichment_result_id_missing");
        const result = await pool.query<{ id: string }>(`select id from lead_finder_results where id=$1 and organization_id=$2`, [resultId, job.organization_id]);
        if (result.rowCount !== 1) throw new Error("agent_lead_enrichment_result_not_found");
        const queued = await pool.query<{ id: string }>(`insert into job_queue (organization_id, kind, payload, priority) values ($1, 'lead_enrichment', $2::jsonb, 50) returning id`, [job.organization_id, JSON.stringify({ result_id: resultId })]);
        if (!queued.rows[0]?.id) throw new Error("agent_lead_enrichment_queue_failed");
        await pool.query(`update agent_tasks set status='completed', result=$3::jsonb, finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [taskId, job.organization_id, JSON.stringify({ result_id: resultId, delegated_job_id: queued.rows[0]?.id ?? null })]);
        return;
      }
      if (task.rows[0].capability === "campaign_execution") {
        const campaignId = typeof task.rows[0].input.campaign_id === "string" ? task.rows[0].input.campaign_id : null;
        if (!campaignId) throw new Error("agent_campaign_execution_campaign_id_missing");
        const campaign = await pool.query<{ id: string }>(`select id from marketing_campaigns where id=$1 and organization_id=$2 and status in ('scheduled','running')`, [campaignId, job.organization_id]);
        if (campaign.rowCount !== 1) throw new Error("agent_campaign_execution_campaign_not_ready");
        const queued = await pool.query<{ id: string }>(`insert into job_queue (organization_id, kind, payload, priority) values ($1, 'campaign_execution', $2::jsonb, 60) returning id`, [job.organization_id, JSON.stringify({ campaign_id: campaignId })]);
        if (!queued.rows[0]?.id) throw new Error("agent_campaign_execution_queue_failed");
        await pool.query(`update agent_tasks set status='completed', result=$3::jsonb, finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [taskId, job.organization_id, JSON.stringify({ campaign_id: campaignId, delegated_job_id: queued.rows[0]?.id ?? null })]);
        return;
      }
      if (task.rows[0].capability === "local_geo_grid") {
        const runId = typeof task.rows[0].input.run_id === "string" ? task.rows[0].input.run_id : null;
        if (!runId) throw new Error("agent_local_geo_grid_run_id_missing");
        const run = await pool.query<{ id: string }>(`select id from local_grid_runs where id=$1 and organization_id=$2 and status='queued'`, [runId, job.organization_id]);
        if (run.rowCount !== 1) throw new Error("agent_local_geo_grid_run_not_ready");
        const queued = await pool.query<{ id: string }>(`insert into job_queue (organization_id, kind, payload, priority) values ($1, 'local_seo_grid', $2::jsonb, 55) returning id`, [job.organization_id, JSON.stringify({ run_id: runId })]);
        if (!queued.rows[0]?.id) throw new Error("agent_local_geo_grid_queue_failed");
        await pool.query(`update agent_tasks set status='completed', result=$3::jsonb, finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [taskId, job.organization_id, JSON.stringify({ run_id: runId, delegated_job_id: queued.rows[0]?.id ?? null })]);
        return;
      }
      if (task.rows[0].capability === "google_business_metrics") {
        const locationId = typeof task.rows[0].input.location_id === "string" ? task.rows[0].input.location_id : null;
        if (!locationId) throw new Error("agent_google_business_location_id_missing");
        const location = await pool.query<{ id: string }>(`select id from google_business_locations where id=$1 and organization_id=$2 and status='active'`, [locationId, job.organization_id]);
        if (location.rowCount !== 1) throw new Error("agent_google_business_location_not_ready");
        const queued = await pool.query<{ id: string }>(`insert into job_queue (organization_id, kind, payload, priority) values ($1, 'google_business_sync', $2::jsonb, 45) returning id`, [job.organization_id, JSON.stringify({ location_id: locationId })]);
        if (!queued.rows[0]?.id) throw new Error("agent_google_business_queue_failed");
        await pool.query(`update agent_tasks set status='completed', result=$3::jsonb, finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [taskId, job.organization_id, JSON.stringify({ location_id: locationId, delegated_job_id: queued.rows[0]?.id ?? null })]);
        return;
      }
      if (task.rows[0].capability === "voice_conversation") {
        const callId = typeof task.rows[0].input.call_id === "string" ? task.rows[0].input.call_id : null;
        if (!callId) throw new Error("agent_voice_conversation_call_id_missing");
        const call = await pool.query<{ id: string }>(`select id from voice_calls where id=$1 and organization_id=$2 and status='queued'`, [callId, job.organization_id]);
        if (call.rowCount !== 1) throw new Error("agent_voice_conversation_call_not_ready");
        const queued = await pool.query<{ id: string }>(`insert into job_queue (organization_id, kind, payload, priority) values ($1, 'voice_call', $2::jsonb, 70) returning id`, [job.organization_id, JSON.stringify({ call_id: callId })]);
        if (!queued.rows[0]?.id) throw new Error("agent_voice_conversation_queue_failed");
        await pool.query(`update agent_tasks set status='completed', result=$3::jsonb, finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [taskId, job.organization_id, JSON.stringify({ call_id: callId, delegated_job_id: queued.rows[0]?.id ?? null })]);
        return;
      }
      if (task.rows[0].capability === "instagram_messaging") {
        const conversationId = typeof task.rows[0].input.conversation_id === "string" ? task.rows[0].input.conversation_id : null;
        const text = typeof task.rows[0].input.text === "string" ? task.rows[0].input.text.trim() : "";
        if (!conversationId) throw new Error("agent_instagram_messaging_conversation_id_missing");
        if (!text || text.length > 1000) throw new Error("agent_instagram_messaging_text_invalid");
        const usage = await pool.query<{ used: string }>(
          `select coalesce(sum(quantity), 0)::text as used from wodesk_usage_events where organization_id=$1 and capability='instagram_messaging' and period_start=$2`,
          [job.organization_id, usagePeriodStart()],
        );
        const plan = await pool.query<{ plan_id: string | null }>(`select plan_id from organizations where id=$1`, [job.organization_id]);
        const entitlement = await pool.query<{ enabled: boolean; monthly_limit: number | null }>(
          `select enabled, monthly_limit from plan_entitlements where plan_id=$1 and capability='instagram_messaging'`,
          [plan.rows[0]?.plan_id ?? ""],
        );
        const decision = decideEntitlement(entitlement.rows[0] ? { enabled: entitlement.rows[0].enabled, monthlyLimit: entitlement.rows[0].monthly_limit } : null, Number(usage.rows[0]?.used ?? 0));
        if (!decision.allowed) throw new Error(`agent_instagram_messaging_plan_limit:${decision.reason}`);
        const conversation = await pool.query<{ id: string }>(
          `select c.id from conversations c join channel_sessions s on s.id=c.channel_session_id and s.organization_id=c.organization_id
           where c.id=$1 and c.organization_id=$2 and c.channel='instagram' and s.provider='instagram_graph' and c.status <> 'closed'`,
          [conversationId, job.organization_id],
        );
        if (conversation.rowCount !== 1) throw new Error("agent_instagram_messaging_conversation_not_ready");
        const queued = await pool.query<{ id: string }>(
          `insert into job_queue (organization_id, kind, payload, priority) values ($1, 'instagram_reply', $2::jsonb, 65) returning id`,
          [job.organization_id, JSON.stringify({ conversation_id: conversationId, text })],
        );
        if (!queued.rows[0]?.id) throw new Error("agent_instagram_messaging_queue_failed");
        await pool.query(`update agent_tasks set status='completed', result=$3::jsonb, finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [taskId, job.organization_id, JSON.stringify({ conversation_id: conversationId, delegated_job_id: queued.rows[0].id, status: "queued" })]);
        return;
      }
      if (task.rows[0].capability === "content_generation") {
        const input = task.rows[0].input;
        const channel = typeof input.channel === "string" ? input.channel : null;
        const contentType = typeof input.content_type === "string" ? input.content_type : null;
        const suppliedBody = typeof input.body === "string" ? input.body.trim() : "";
        const shouldGenerate = input.generate === true || !suppliedBody;
        if (!channel || !contentType || !CONTENT_CHANNELS.has(channel) || !CONTENT_TYPES.has(contentType) || (!suppliedBody && !shouldGenerate)) throw new Error("agent_content_generation_input_invalid");
        const usage = await pool.query<{ used: string }>(
          `select coalesce(sum(quantity), 0)::text as used from wodesk_usage_events where organization_id=$1 and capability='content_generation' and period_start=$2`,
          [job.organization_id, usagePeriodStart()],
        );
        const plan = await pool.query<{ plan_id: string | null }>(`select plan_id from organizations where id=$1`, [job.organization_id]);
        const entitlement = await pool.query<{ enabled: boolean; monthly_limit: number | null }>(
          `select enabled, monthly_limit from plan_entitlements where plan_id=$1 and capability='content_generation'`,
          [plan.rows[0]?.plan_id ?? ""],
        );
        const decision = decideEntitlement(entitlement.rows[0] ? { enabled: entitlement.rows[0].enabled, monthlyLimit: entitlement.rows[0].monthly_limit } : null, Number(usage.rows[0]?.used ?? 0));
        if (!decision.allowed) throw new Error(`agent_content_generation_plan_limit:${decision.reason}`);
        let body = suppliedBody;
        if (shouldGenerate) {
          if (!llmCfg) throw new Error("agent_content_generation_llm_not_configured");
          const context = [
            `Canal: ${channel}`,
            `Formato: ${contentType}`,
            `Contexto do negócio: ${typeof input.business_context === "string" ? input.business_context.trim() : ""}`,
            `Público: ${typeof input.audience === "string" ? input.audience.trim() : ""}`,
            `Tom: ${typeof input.tone === "string" ? input.tone.trim() : ""}`,
            `Objetivo: ${typeof input.objective === "string" ? input.objective.trim() : ""}`,
            `Orientação adicional: ${typeof input.prompt === "string" ? input.prompt.trim() : ""}`,
          ].join("\\n");
          const generated = await runModelCall(pool, llmCfg, {
            tenantId: job.organization_id,
            jobId: job.id,
            purpose: "content_generation",
            model: typeof input.model === "string" ? input.model : undefined,
            system: "Você é um redator de marketing responsável. Gere somente o conteúdo solicitado, sem explicar o processo, sem inventar ofertas, preços ou fatos não fornecidos.",
            messages: [{ role: "user", content: context }],
          });
          body = generated.result.text.trim();
          if (!body) throw new Error("agent_content_generation_empty");
        }
        const created = await pool.query<{ id: string }>(
          `insert into marketing_contents (organization_id, channel, content_type, status, title, body, media, context, created_by)
           values ($1, $2, $3, 'draft', $4, $5, '[]'::jsonb, $6::jsonb, null)
           returning id`,
          [job.organization_id, channel, contentType, typeof input.title === "string" ? input.title.trim() || null : null, body, JSON.stringify({
            organizationId: job.organization_id,
            channel,
            contentType,
            businessContext: typeof input.business_context === "string" ? input.business_context : "",
            audience: typeof input.audience === "string" ? input.audience : "",
            tone: typeof input.tone === "string" ? input.tone : "",
            objective: typeof input.objective === "string" ? input.objective : "",
          })],
        );
        if (!created.rows[0]?.id) throw new Error("agent_content_generation_persist_failed");
        try {
          await pool.query(
            `insert into wodesk_usage_events (organization_id, capability, quantity, idempotency_key, metadata)
             values ($1, 'content_generation', 1, $2, $3::jsonb)
             on conflict (organization_id, idempotency_key) do nothing`,
            [job.organization_id, `agent-content:${taskId}`, JSON.stringify({ content_id: created.rows[0].id, source: "agent_task" })],
          );
        } catch {
          // Telemetria é best-effort; não transforma um rascunho válido em falha.
        }
        await pool.query(`update agent_tasks set status='completed', result=$3::jsonb, finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [taskId, job.organization_id, JSON.stringify({ content_id: created.rows[0].id, status: "draft", requires_approval: true })]);
        return;
      }
      if (task.rows[0].capability !== "lead_scoring") {
        throw new Error(`agent_capability_executor_not_configured:${task.rows[0].capability}`);
      }
      const resultId = typeof task.rows[0].input.result_id === "string" ? task.rows[0].input.result_id : null;
      if (!resultId) throw new Error("agent_lead_scoring_result_id_missing");
      const result = await pool.query<{ name: string; website: string | null; instagram: string | null; rating: number | null; review_count: number | null }>(
        `select name, website, instagram, rating, review_count from lead_finder_results where id=$1 and organization_id=$2`, [resultId, job.organization_id]);
      if (result.rowCount !== 1 || !result.rows[0]) throw new Error("agent_lead_scoring_result_not_found");
      const row = result.rows[0];
      const diagnostic = generateLeadDiagnostic(row.name, { hasWebsite: Boolean(row.website), rating: row.rating ?? undefined, reviewCount: row.review_count ?? undefined, instagramQuality: row.instagram ? undefined : "poor" });
      await pool.query(`update lead_enrichment set score=$3, score_band=$4, score_reasons=$5::jsonb, updated_at=now() where result_id=$1 and organization_id=$2`, [resultId, job.organization_id, diagnostic.score, diagnostic.scoreBand, JSON.stringify({ problems: diagnostic.problems, opportunities: diagnostic.opportunities })]);
      try {
        await pool.query(
          `insert into wodesk_usage_events (organization_id, capability, quantity, idempotency_key, metadata)
           values ($1, 'lead_scoring', 1, $2, $3::jsonb)
           on conflict (organization_id, idempotency_key) do nothing`,
          [job.organization_id, `agent-lead-scoring:${taskId}`, JSON.stringify({ result_id: resultId, source: "agent_task" })],
        );
      } catch {
        // O diagnóstico persistido é válido mesmo se a telemetria estiver indisponível.
      }
      await pool.query(`update agent_tasks set status='completed', result=$3::jsonb, finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [taskId, job.organization_id, JSON.stringify({ result_id: resultId, diagnostic })]);
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 120) : "agent_task_failed";
      await pool.query(`update agent_tasks set status='failed', error_code=$3, finished_at=now(), updated_at=now() where id=$1 and organization_id=$2 and status='running'`, [taskId, job.organization_id, code]);
      throw error;
    }
  };
}
