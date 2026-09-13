import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_contact_timeline" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "omnichannel").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "A visão omnichannel não está habilitada para esta organização.", 403, { requestId });
  const [messagesResult, activitiesResult, proposalsResult, voiceCallsResult, appointmentsResult, tasksResult] = await Promise.all([
    supabase.from("messages").select("id, conversation_id, direction, type, body, sent_via, status, sent_at, created_at, metadata").eq("organization_id", authz.org.orgId).eq("contact_id", id).order("sent_at", { ascending: false }).limit(100),
    supabase.from("crm_lead_activities").select("id, lead_id, type, reason, source_module, performed_at, actor_kind, payload, metadata").eq("organization_id", authz.org.orgId).eq("contact_id", id).order("performed_at", { ascending: false }).limit(100),
    supabase.from("commercial_proposals").select("id, lead_id, status, title, total_cents, currency, accepted_at, created_at, updated_at").eq("organization_id", authz.org.orgId).eq("contact_id", id).order("updated_at", { ascending: false }).limit(100),
    supabase.from("voice_calls").select("id, direction, provider_id, status, started_at, ended_at, duration_seconds, cost_cents, created_at").eq("organization_id", authz.org.orgId).eq("contact_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("calendar_appointments").select("id, title, description, starts_at, ends_at, status, location_kind, meeting_url, notes, created_at").eq("organization_id", authz.org.orgId).eq("contact_id", id).order("starts_at", { ascending: false }).limit(100),
    supabase.from("crm_tasks").select("id, title, description, due_date, priority, status, created_at, updated_at").eq("organization_id", authz.org.orgId).eq("contact_id", id).order("updated_at", { ascending: false }).limit(100),
  ]);
  if (messagesResult.error) return fail("internal_error", messagesResult.error.message, 500, { requestId });
  if (activitiesResult.error) return fail("internal_error", activitiesResult.error.message, 500, { requestId });
  if (proposalsResult.error) return fail("internal_error", proposalsResult.error.message, 500, { requestId });
  if (voiceCallsResult.error) return fail("internal_error", voiceCallsResult.error.message, 500, { requestId });
  if (appointmentsResult.error) return fail("internal_error", appointmentsResult.error.message, 500, { requestId });
  if (tasksResult.error) return fail("internal_error", tasksResult.error.message, 500, { requestId });
  const events = [
    ...(messagesResult.data ?? []).map((message) => ({
      id: `message:${message.id}`,
      kind: "message" as const,
      occurred_at: message.sent_at ?? message.created_at,
      channel: message.sent_via,
      data: message,
    })),
    ...(activitiesResult.data ?? []).map((activity) => ({
      id: `activity:${activity.id}`,
      kind: "activity" as const,
      occurred_at: activity.performed_at,
      channel: null,
      data: activity,
    })),
    ...(proposalsResult.data ?? []).map((proposal) => ({
      id: `proposal:${proposal.id}`,
      kind: "proposal" as const,
      occurred_at: proposal.accepted_at ?? proposal.updated_at ?? proposal.created_at,
      channel: "sales" as const,
      data: proposal,
    })),
    ...(voiceCallsResult.data ?? []).map((call) => ({
      id: `voice_call:${call.id}`,
      kind: "voice_call" as const,
      occurred_at: call.started_at ?? call.created_at,
      channel: "voice" as const,
      data: call,
    })),
    ...(appointmentsResult.data ?? []).map((appointment) => ({
      id: `appointment:${appointment.id}`,
      kind: "appointment" as const,
      occurred_at: appointment.starts_at,
      channel: appointment.location_kind,
      data: appointment,
    })),
    ...(tasksResult.data ?? []).map((task) => ({
      id: `task:${task.id}`,
      kind: "task" as const,
      occurred_at: task.due_date ?? task.updated_at ?? task.created_at,
      channel: "crm" as const,
      data: task,
    })),
  ].sort((left, right) => new Date(right.occurred_at).valueOf() - new Date(left.occurred_at).valueOf());
  return ok({ contact_id: id, events }, { requestId });
}
