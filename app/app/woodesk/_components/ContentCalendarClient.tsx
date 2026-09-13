"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Item = { id: string; scheduled_for: string; timezone: string; status: string; provider_id: string | null; external_id?: string | null; error_code?: string | null; marketing_contents?: { title?: string | null; channel?: string; content_type?: string } | null };

export function ContentCalendarClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => { const response = await fetch("/api/v1/woodesk/content/calendar"); if (!response.ok) throw new Error("calendar_failed"); const payload = await response.json() as { data?: { items?: Item[] } }; setItems(payload.data?.items ?? []); }, []);
  useEffect(() => { void load().catch(() => setMessage("Não foi possível carregar o calendário editorial.")); }, [load]);
  return <div className="flex h-full flex-col gap-6 p-6"><header><h1 className="text-2xl font-semibold tracking-tight">Calendário de conteúdo</h1><p className="text-sm text-muted-foreground">Veja os conteúdos aprovados e agendados para os próximos 31 dias.</p></header>{message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}<Card><CardHeader><CardTitle className="text-base">Próximas publicações</CardTitle></CardHeader><CardContent>{items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma publicação agendada.</p> : <ul className="divide-y">{items.map((item) => <li key={item.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span><strong>{item.marketing_contents?.title ?? "Sem título"}</strong> · {item.marketing_contents?.channel ?? "canal"} · {item.marketing_contents?.content_type ?? "conteúdo"}{item.error_code && <><br /><span className="text-destructive">Falha: {item.error_code}</span></>}</span><span className="text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.scheduled_for))} · {item.status}{item.external_id ? ` · ${item.external_id}` : ""}</span></li>)}</ul>}</CardContent></Card></div>;
}
