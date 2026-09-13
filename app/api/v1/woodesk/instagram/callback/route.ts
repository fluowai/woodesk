import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { NOME_DO_VINCULO, vinculoConfere } from "@/lib/agenda/google/vinculo";
import { exchangeInstagramCode, verifyInstagramState } from "@/lib/woodesk/instagram/oauth";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const url = new URL(request.url);
  const state = verifyInstagramState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  if (!state || !code || !state.userId || !state.authSessionId) return NextResponse.redirect(new URL("/app/woodesk?instagram=invalid_state", request.url));
  if (!vinculoConfere(request.cookies.get(NOME_DO_VINCULO)?.value, state.nonce, env.INTERNAL_SECRET)) return NextResponse.redirect(new URL("/app/woodesk?instagram=invalid_session", request.url));
  const admin = createAdminClient();
  const { data: flag, error: flagError } = await admin.from("feature_flags").select("enabled").eq("organization_id", state.orgId).eq("key", "instagram_studio").maybeSingle();
  if (flagError || !flag?.enabled) return NextResponse.redirect(new URL(`/app/woodesk?instagram=${flagError ? "unavailable" : "disabled"}`, request.url));
  const { error: nonceError } = await admin.from("calendar_oauth_nonces").insert({ nonce: state.nonce, organization_id: state.orgId, user_id: state.userId, expira_em: new Date(state.expMs).toISOString() });
  if (nonceError) return NextResponse.redirect(new URL("/app/woodesk?instagram=state_reused", request.url));
  try {
    const redirectUri = new URL("/api/v1/woodesk/instagram/callback", request.url).toString();
    const { accessToken, expiresIn } = await exchangeInstagramCode({ code, redirectUri });
    const { data: encrypted, error: encryptError } = await admin.rpc("fn_encrypt_oauth", { plaintext: accessToken });
    if (encryptError || !encrypted) throw new Error("Falha ao cifrar credencial Instagram");
    const accountResponse = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v22.0"}/me/accounts?fields=id,instagram_business_account,username`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!accountResponse.ok) throw new Error("Não foi possível descobrir a conta Instagram");
    const accountPayload = (await accountResponse.json()) as { data?: Array<{ id?: string; username?: string; instagram_business_account?: { id?: string } }> };
    const page = accountPayload.data?.find((item) => item.instagram_business_account?.id);
    const accountId = page?.instagram_business_account?.id;
    if (!accountId) return NextResponse.redirect(new URL("/app/woodesk?instagram=no_business_account", request.url));
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    const instagramAccountsTable: string = "instagram_accounts";
    const { data: account, error: upsertError } = await admin.from(instagramAccountsTable).upsert({ organization_id: state.orgId, instagram_business_account_id: accountId, page_id: page?.id ?? null, username: page?.username ?? null, access_token_encrypted: encrypted, token_expires_at: tokenExpiresAt, status: "connected", updated_at: new Date().toISOString() }, { onConflict: "organization_id,instagram_business_account_id" }).select("id").single();
    if (upsertError) throw new Error("Falha ao persistir conexão Instagram");
    if (!account?.id) throw new Error("Conexão Instagram sem identificador");

    const webhookSecret = randomUUID();
    const { data: encryptedWebhookSecret, error: webhookSecretError } = await admin.rpc("fn_encrypt_oauth", { plaintext: webhookSecret });
    if (webhookSecretError || !encryptedWebhookSecret) throw new Error("Falha ao cifrar sessão Instagram");
    const channelSessions = admin.from("channel_sessions" as never) as unknown as {
      select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } } };
      insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> };
    };
    const existingSession = await channelSessions.select("id").eq("organization_id", state.orgId).eq("instagram_account_id", account.id).maybeSingle();
    if (existingSession.error) throw new Error("Falha ao consultar sessão Instagram");
    if (existingSession.data) {
      const { error } = await channelSessions.update({ provider: "instagram_graph", instagram_account_id: account.id, engine: "INSTAGRAM_GRAPH", status: "WORKING", archived_at: null, webhook_secret_encrypted: encryptedWebhookSecret }).eq("id", existingSession.data.id);
      if (error) throw new Error("Falha ao atualizar sessão Instagram");
    } else {
      const { error } = await channelSessions.insert({ organization_id: state.orgId, provider: "instagram_graph", instagram_account_id: account.id, display_name: page?.username ? `Instagram @${page.username}` : "Instagram", engine: "INSTAGRAM_GRAPH", status: "WORKING", webhook_path_token: randomUUID(), webhook_secret_encrypted: encryptedWebhookSecret, metadata: { instagram_business_account_id: accountId, page_id: page?.id ?? null } });
      if (error) throw new Error("Falha ao criar sessão Instagram");
    }
    await audit({ action: "woodesk.instagram_connected", actorUserId: state.userId, actorAuthSessionId: state.authSessionId, organizationId: state.orgId, resourceType: "instagram_account", resourceId: accountId, requestId, metadata: { page_id: page?.id ?? null, username: page?.username ?? null } });
    return NextResponse.redirect(new URL("/app/woodesk?instagram=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/app/woodesk?instagram=connection_failed", request.url));
  }
}
