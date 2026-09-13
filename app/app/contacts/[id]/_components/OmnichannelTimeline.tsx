"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Event = { id: string; kind: string; occurred_at: string; channel: string | null; data: { body?: string | null; reason?: string | null; title?: string | null; status?: string | null; total_cents?: number | null } };

export function OmnichannelTimeline({ contactId }: { contactId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/woodesk/omnichannel/contacts/${contactId}/timeline`);
      if (!response.ok) throw new Error("timeline_failed");
      const payload = await response.json() as { data?: { events?: Event[] } };
      setEvents(payload.data?.events ?? []);
    } catch {
      setMessage("A timeline Growth não está disponível para esta organização.");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);
  return <div className="space-y-3">{loading ? <p className="text-sm text-muted-foreground" role="status">Carregando timeline Growth…</p> : message ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-muted-foreground" role="alert">{message}</p><Button type="button" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div> : events.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento omnichannel registrado.</p> : events.map((event) => <Card key={event.id} className="p-4"><div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{event.kind}{event.channel ? ` · ${event.channel}` : ""}</span><time dateTime={event.occurred_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.occurred_at))}</time></div><p className="mt-2 text-sm">{event.data.title ?? event.data.reason ?? event.data.body ?? event.data.status ?? "Evento registrado"}{event.data.total_cents != null ? ` · ${(event.data.total_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}</p></Card>)}</div>;
}
