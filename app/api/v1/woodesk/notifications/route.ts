import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_notifications" });
  if (!authz.ok) return authz.response;
  const db = await createClient();
  const table: string = "woodesk_notifications";
  const { data, error } = await db.from(table).select("id, kind, title, body, metadata, read_at, created_at").eq("organization_id", authz.org.orgId).or(`user_id.is.null,user_id.eq.${authz.user.id}`).order("created_at", { ascending: false }).limit(100);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data || data.length === 0) return ok({ notifications: [] }, { requestId });
  const readsTable: string = "woodesk_notification_reads";
  const { data: reads, error: readsError } = await db.from(readsTable).select("notification_id, read_at").eq("organization_id", authz.org.orgId).eq("user_id", authz.user.id).in("notification_id", data.map((item) => item.id));
  if (readsError) return fail("internal_error", readsError.message, 500, { requestId });
  const readById = new Map((reads ?? []).map((read) => [read.notification_id, read.read_at]));
  return ok({ notifications: data.map((item) => ({ ...item, read_at: readById.get(item.id) ?? null })) }, { requestId });
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_notifications" });
  if (!authz.ok) return authz.response;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail("validation_failed", "Notificação inválida.", 422, { requestId });
  const db = await createClient();
  const table: string = "woodesk_notifications";
  const { data: notification, error: notificationError } = await db.from(table).select("id").eq("id", parsed.data.id).eq("organization_id", authz.org.orgId).or(`user_id.is.null,user_id.eq.${authz.user.id}`).maybeSingle();
  if (notificationError) return fail("internal_error", notificationError.message, 500, { requestId });
  if (!notification) return fail("not_found", "Notificação não encontrada.", 404, { requestId });
  const readsTable: string = "woodesk_notification_reads";
  const { data, error } = await db.from(readsTable).upsert({ organization_id: authz.org.orgId, notification_id: notification.id, user_id: authz.user.id, read_at: new Date().toISOString() }, { onConflict: "notification_id,user_id" }).select("notification_id, read_at").single();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ id: data.notification_id, read_at: data.read_at }, { requestId });
}
