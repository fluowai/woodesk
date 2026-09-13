import { issueState, verifyState, type VerifiedState } from "@/lib/nuvemshop/state";

const graphVersion = () => process.env.META_GRAPH_VERSION ?? "v22.0";

export function instagramAuthorizeUrl(input: { state: string; redirectUri: string }): string {
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("META_APP_ID ausente");
  const url = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_basic,instagram_content_publish,pages_show_list,instagram_manage_messages");
  return url.toString();
}

export function issueInstagramState(orgId: string, actor: { userId: string; authSessionId: string }): string {
  return issueState(orgId, actor);
}

export function verifyInstagramState(value: string | null): VerifiedState | null {
  return verifyState(value);
}

export async function exchangeInstagramCode(input: { code: string; redirectUri: string }): Promise<{ accessToken: string; expiresIn: number | null }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Credenciais Meta OAuth ausentes");
  const body = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: input.redirectUri, code: input.code });
  const response = await fetch(`https://graph.facebook.com/${graphVersion()}/oauth/access_token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("Falha ao trocar código OAuth do Instagram");
  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Resposta OAuth sem token");
  return { accessToken: json.access_token, expiresIn: typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : null };
}
