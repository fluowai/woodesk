"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Content = { id: string; channel: string; content_type: string; status: string; title: string | null; body: string; media?: unknown; context?: { instagram_account_id?: string }; created_at: string };
type InstagramAccount = { id: string; instagram_business_account_id: string; page_id: string | null; username: string | null; token_expires_at: string | null; status: string };
type InstagramContentType = "post" | "carousel" | "story" | "reel" | "caption" | "script";

export function ContentStudioClient() {
  const [contents, setContents] = useState<Content[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [contentType, setContentType] = useState<InstagramContentType>("post");
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);

  const load = useCallback(async () => {
    const [contentResponse, accountResponse] = await Promise.all([
      fetch("/api/v1/woodesk/content/drafts?channel=instagram"),
      fetch("/api/v1/woodesk/instagram/accounts"),
    ]);
    if (!contentResponse.ok) throw new Error("content_load_failed");
    const payload = await contentResponse.json() as { data?: { contents?: Content[] } };
    setContents(payload.data?.contents ?? []);
    if (accountResponse.ok) {
      const accountPayload = await accountResponse.json() as { data?: InstagramAccount[] };
      setAccounts(accountPayload.data ?? []);
    }
  }, []);
  useEffect(() => { void load().catch(() => setMessage("Não foi possível carregar o conteúdo.")); }, [load]);

  function accountLabel(content: Content): string | null {
    const accountId = content.context?.instagram_account_id;
    if (!accountId) return null;
    const account = accounts.find((item) => item.id === accountId);
    return account ? `@${account.username ?? account.instagram_business_account_id}` : "conta selecionada";
  }

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const mediaUrls = mediaUrl.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
      const response = await fetch("/api/v1/woodesk/content/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "instagram", content_type: contentType, business_context: "Negócio local", audience: "Clientes da região", tone: "Claro e profissional", objective: "Gerar interesse", title, body, ...(instagramAccountId ? { instagram_account_id: instagramAccountId } : {}), ...(mediaUrls.length > 1 ? { media_urls: mediaUrls } : mediaUrls[0] ? { media_url: mediaUrls[0] } : {}) }) });
      if (!response.ok) throw new Error("content_create_failed");
      setTitle(""); setBody(""); setMediaUrl(""); setContentType("post"); setMessage("Conteúdo criado como rascunho."); await load();
    } catch { setMessage("Não foi possível criar o conteúdo. Verifique o recurso e o plano."); }
    finally { setBusy(false); }
  }

  async function approve(id: string) {
    const response = await fetch(`/api/v1/woodesk/content/${id}/approve`, { method: "POST" });
    setMessage(response.ok ? "Conteúdo aprovado." : "Não foi possível aprovar o conteúdo.");
    if (response.ok) await load();
  }

  async function schedule(id: string) {
    const value = scheduleAt[id];
    if (!value) { setMessage("Informe data e hora para agendar."); return; }
    const response = await fetch(`/api/v1/woodesk/content/${id}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduled_for: new Date(value).toISOString(), timezone: "America/Sao_Paulo" }) });
    setMessage(response.ok ? "Conteúdo agendado." : "Não foi possível agendar o conteúdo.");
    if (response.ok) await load();
  }

  async function publishNow(id: string) {
    const response = await fetch(`/api/v1/woodesk/content/${id}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publish_now: true, timezone: "America/Sao_Paulo" }) });
    setMessage(response.ok ? "Publicação enfileirada." : "Não foi possível enfileirar a publicação.");
    if (response.ok) await load();
  }

  async function disconnect(id: string) {
    const response = await fetch(`/api/v1/woodesk/instagram/accounts/${id}`, { method: "DELETE" });
    setMessage(response.ok ? "Conta Instagram desconectada." : "Não foi possível desconectar a conta.");
    if (response.ok) await load();
  }

  return <div className="flex h-full flex-col gap-6 p-6">
    <header><h1 className="text-2xl font-semibold tracking-tight">Instagram Studio</h1><p className="text-sm text-muted-foreground">Crie, revise e aprove conteúdo antes de qualquer publicação externa.</p></header>
    {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
    <Card><CardHeader><CardTitle className="text-base">Conta Instagram</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-col gap-2 text-sm">{accounts.length === 0 ? <span className="text-muted-foreground">Nenhuma conta Business conectada.</span> : accounts.map((account) => <span key={account.id} className="flex flex-wrap items-center gap-2 font-medium">@{account.username ?? account.instagram_business_account_id} · {account.status}<Button type="button" variant="ghost" size="sm" onClick={() => void disconnect(account.id)}>Desconectar</Button></span>)}</div><Button asChild variant="secondary"><a href="/api/v1/woodesk/instagram/connect">{accounts.length === 0 ? "Conectar Instagram" : "Reconectar Instagram"}</a></Button></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Novo conteúdo para Instagram</CardTitle></CardHeader><CardContent><form onSubmit={create} className="space-y-3"><div className="flex flex-wrap gap-3"><label className="flex flex-col gap-1 text-sm"><span>Formato</span><select aria-label="Formato do conteúdo" className="h-10 rounded-md border bg-background px-3" value={contentType} onChange={(event) => setContentType(event.target.value as InstagramContentType)}><option value="post">Post</option><option value="carousel">Carrossel</option><option value="story">Story</option><option value="reel">Reel</option><option value="caption">Legenda</option><option value="script">Roteiro</option></select></label><label className="flex flex-col gap-1 text-sm"><span>Conta</span><select aria-label="Conta Instagram" className="h-10 rounded-md border bg-background px-3" value={instagramAccountId} onChange={(event) => setInstagramAccountId(event.target.value)}><option value="">Selecionar depois</option>{accounts.filter((account) => account.status === "connected").map((account) => <option key={account.id} value={account.id}>@{account.username ?? account.instagram_business_account_id}</option>)}</select></label><Input aria-label="Título" placeholder="Título opcional" value={title} onChange={(event) => setTitle(event.target.value)} /></div><textarea aria-label="Conteúdo" className="min-h-32 w-full rounded-md border bg-background p-3 text-sm" placeholder="Escreva a legenda ou o conteúdo" value={body} onChange={(event) => setBody(event.target.value)} required /><textarea aria-label="Mídias HTTPS" className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" placeholder="URLs HTTPS de mídia, uma por linha (carrossel aceita até 10)" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} /><p className="text-xs text-muted-foreground">Para publicação externa, informe mídias públicas em HTTPS quando o formato exigir.</p><Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Criar rascunho"}</Button></form></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Conteúdos recentes</CardTitle></CardHeader><CardContent>{contents.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum conteúdo criado ainda.</p> : <ul className="divide-y">{contents.map((content) => <li key={content.id} className="flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"><span className="min-w-0 break-words"><strong>{content.title ?? "Sem título"}</strong> · {content.status}{Array.isArray(content.media) && content.media.length > 0 ? " · com mídia" : ""}{accountLabel(content) ? ` · ${accountLabel(content)}` : ""}<br /><span className="whitespace-pre-wrap text-muted-foreground">{content.body}</span></span><span className="flex flex-wrap items-center gap-2">{content.status === "draft" || content.status === "review" ? <Button type="button" variant="secondary" onClick={() => void approve(content.id)}>Aprovar</Button> : null}{content.status === "approved" ? <><Button type="button" variant="secondary" onClick={() => void publishNow(content.id)}>Publicar agora</Button><Input aria-label={`Data para ${content.title ?? "conteúdo"}`} type="datetime-local" value={scheduleAt[content.id] ?? ""} onChange={(event) => setScheduleAt((current) => ({ ...current, [content.id]: event.target.value }))} /><Button type="button" onClick={() => void schedule(content.id)}>Agendar</Button></> : null}</span></li>)}</ul>}</CardContent></Card>
  </div>;
}
