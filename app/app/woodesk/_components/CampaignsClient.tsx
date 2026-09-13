"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Campaign = { id: string; name: string; objective: string; channel: string; status: string; created_at: string };

export function CampaignsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/v1/woodesk/marketing/campaigns");
    if (!response.ok) throw new Error("campaigns_load_failed");
    const payload = await response.json() as { data?: { campaigns?: Campaign[] } };
    setCampaigns(payload.data?.campaigns ?? []);
  }, []);

  useEffect(() => { void load().catch(() => setMessage("Não foi possível carregar as campanhas.")); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/v1/woodesk/marketing/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, objective, channel }) });
      if (!response.ok) throw new Error("campaign_create_failed");
      setName(""); setObjective(""); setMessage("Campanha criada como rascunho."); await load();
    } catch { setMessage("Não foi possível criar a campanha. Verifique o recurso e o plano."); }
    finally { setBusy(false); }
  }

  async function submit(id: string) {
    const response = await fetch(`/api/v1/woodesk/marketing/campaigns/${id}/submit`, { method: "POST" });
    if (!response.ok) { setMessage("Não foi possível enviar a campanha para revisão."); return; }
    setMessage("Campanha enviada para revisão."); await load();
  }

  async function approve(id: string) {
    const response = await fetch(`/api/v1/woodesk/marketing/campaigns/${id}/approve`, { method: "POST" });
    if (!response.ok) { setMessage("Não foi possível aprovar a campanha."); return; }
    setMessage("Campanha aprovada. Defina a data de execução."); await load();
  }

  async function schedule(id: string) {
    if (!scheduleAt) { setMessage("Informe uma data futura para a execução."); return; }
    const response = await fetch(`/api/v1/woodesk/marketing/campaigns/${id}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starts_at: new Date(scheduleAt).toISOString() }) });
    if (!response.ok) { setMessage("Não foi possível agendar a campanha. Verifique a data, o plano e a capacidade do canal."); return; }
    setScheduleId(null); setScheduleAt(""); setMessage("Campanha agendada."); await load();
  }

  return <div className="flex h-full flex-col gap-6 p-6">
    <header><h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1><p className="text-sm text-muted-foreground">Planeje campanhas, revise o conteúdo e agende a execução pelos canais configurados.</p></header>
    {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
    <Card><CardHeader><CardTitle className="text-base">Nova campanha</CardTitle></CardHeader><CardContent><form onSubmit={create} className="grid gap-3"><Input aria-label="Nome da campanha" placeholder="Nome da campanha" value={name} onChange={(event) => setName(event.target.value)} required /><Input aria-label="Objetivo" placeholder="Objetivo" value={objective} onChange={(event) => setObjective(event.target.value)} required /><div className="flex flex-wrap gap-3"><select aria-label="Canal" className="h-10 rounded-md border bg-background px-3 text-sm" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="email">E-mail</option><option value="sms">SMS</option><option value="voice">Voz</option></select><Button type="submit" disabled={busy}>{busy ? "Criando…" : "Criar rascunho"}</Button></div></form></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Campanhas recentes</CardTitle></CardHeader><CardContent>{campaigns.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p> : <ul className="divide-y">{campaigns.map((campaign) => <li key={campaign.id} className="flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 break-words"><strong>{campaign.name}</strong> · {campaign.channel} · {campaign.status}<br /><span className="text-muted-foreground">{campaign.objective}</span></span><div className="flex flex-wrap gap-2">{campaign.status === "draft" && <Button type="button" variant="secondary" onClick={() => void submit(campaign.id)}>Enviar para revisão</Button>}{campaign.status === "review" && <Button type="button" variant="secondary" onClick={() => void approve(campaign.id)}>Aprovar</Button>}{campaign.status === "approved" && (scheduleId === campaign.id ? <><Input aria-label="Data da execução" type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /><Button type="button" onClick={() => void schedule(campaign.id)}>Confirmar</Button><Button type="button" variant="ghost" onClick={() => setScheduleId(null)}>Cancelar</Button></> : <Button type="button" onClick={() => setScheduleId(campaign.id)}>Agendar</Button>)}</div></li>)}</ul>}</CardContent></Card>
  </div>;
}
