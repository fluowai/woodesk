"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Location = { id: string; title: string; resource_name: string; status: string; last_synced_at: string | null };
type Snapshot = { id: string; location_id: string; period_start: string; period_end: string; metrics: Record<string, number>; source?: string | null; google_business_locations?: { title?: string } | null };

export function GoogleBusinessClient() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [locationsResponse, metricsResponse] = await Promise.all([
      fetch("/api/v1/woodesk/google-business/locations"),
      fetch("/api/v1/woodesk/google-business/metrics"),
    ]);
    if (!locationsResponse.ok || !metricsResponse.ok) throw new Error("google_business_load_failed");
    const locationsPayload = await locationsResponse.json() as { data?: { locations?: Location[] } };
    const metricsPayload = await metricsResponse.json() as { data?: { metrics?: Snapshot[] } };
    setLocations(locationsPayload.data?.locations ?? []);
    setSnapshots(metricsPayload.data?.metrics ?? []);
  }, []);

  useEffect(() => { void load().catch(() => setMessage("Não foi possível carregar os dados do Google Business.")); }, [load]);

  async function sync(locationId: string) {
    setMessage(null);
    const response = await fetch(`/api/v1/woodesk/google-business/locations/${locationId}/sync`, { method: "POST" });
    if (!response.ok) { setMessage("Não foi possível enfileirar a sincronização."); return; }
    setMessage("Sincronização enfileirada. Atualize em alguns instantes para ver o snapshot.");
  }

  return <div className="flex h-full flex-col gap-6 p-6">
    <header><h1 className="text-2xl font-semibold tracking-tight">Google Business</h1><p className="text-sm text-muted-foreground">Acompanhe a descoberta local a partir dos dados oficiais do seu perfil.</p></header>
    {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
    <section aria-label="Locais conectados" className="grid gap-4 md:grid-cols-2">{locations.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum local conectado ainda.</CardContent></Card> : locations.map((location) => <Card key={location.id}><CardHeader><CardTitle className="text-base">{location.title}</CardTitle></CardHeader><CardContent className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{location.last_synced_at ? `Última sincronização: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(location.last_synced_at))}` : "Ainda não sincronizado"}</span><Button type="button" variant="secondary" onClick={() => void sync(location.id)} disabled={location.status === "paused"}>Sincronizar</Button></CardContent></Card>)}</section>
    <Card><CardHeader><CardTitle className="text-base">Snapshots recentes</CardTitle></CardHeader><CardContent>{snapshots.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma métrica sincronizada ainda.</p> : <ul className="divide-y">{snapshots.slice(0, 10).map((snapshot) => <li key={snapshot.id} className="space-y-2 py-3 text-sm"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><span>{snapshot.google_business_locations?.title ?? snapshot.location_id} · {snapshot.period_start} a {snapshot.period_end}</span><span className="text-xs text-muted-foreground">Fonte: {snapshot.source ?? "Google Business"}</span></div><div className="grid gap-2 sm:grid-cols-3">{Object.entries(snapshot.metrics).map(([key, value]) => <div key={key} className="rounded-md border px-3 py-2"><div className="text-xs text-muted-foreground">{key.replaceAll("_", " ")}</div><div className="font-medium">{new Intl.NumberFormat("pt-BR").format(value)}</div></div>)}</div></li>)}</ul>}</CardContent></Card>
  </div>;
}
