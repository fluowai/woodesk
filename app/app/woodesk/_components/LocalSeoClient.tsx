"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Run = { id: string; grid_size: number; status: string; provider_id: string; created_at: string; local_keywords?: { keyword?: string } | null };
type Point = { id: string; row_index: number; column_index: number; position: number | null; latitude: number; longitude: number };
type RunDetail = { run: Run; points: Point[]; metrics: { averagePosition: number | null; bestPosition: number | null; worstPosition: number | null; top10Percent: number } };

export function LocalSeoClient() {
  const [keyword, setKeyword] = useState("");
  const [targetBusinessName, setTargetBusinessName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);

  async function loadRuns() {
    const response = await fetch("/api/v1/woodesk/local-seo/runs");
    if (!response.ok) throw new Error("local_seo_load_failed");
    const payload = await response.json() as { data?: { runs?: Run[] } };
    setRuns(payload.data?.runs ?? []);
  }

  useEffect(() => { void loadRuns().catch(() => setMessage("Não foi possível carregar as execuções.")); }, []);

  async function startRun(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/v1/woodesk/local-seo/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword, target_business_name: targetBusinessName, center_latitude: Number(latitude), center_longitude: Number(longitude), grid_size: 5 }) });
      if (!response.ok) throw new Error("local_seo_start_failed");
      setMessage("GeoGrid enfileirado. A execução aparecerá na lista quando começar.");
      setKeyword(""); setTargetBusinessName(""); await loadRuns();
    } catch { setMessage("Não foi possível iniciar o GeoGrid. Verifique as coordenadas, o provider e o plano."); }
    finally { setBusy(false); }
  }

  async function openRun(id: string) {
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/woodesk/local-seo/runs/${id}`);
      if (!response.ok) throw new Error("local_seo_detail_failed");
      const payload = await response.json() as { data?: RunDetail };
      setDetail(payload.data ?? null);
    } catch { setMessage("Não foi possível carregar o mapa desta execução."); }
  }

  function band(position: number | null): string {
    if (position === null) return "bg-muted text-muted-foreground";
    if (position <= 3) return "bg-emerald-500 text-white";
    if (position <= 10) return "bg-amber-400 text-black";
    if (position <= 20) return "bg-orange-500 text-white";
    return "bg-red-500 text-white";
  }

  return <div className="flex h-full flex-col gap-6 p-6">
    <header><h1 className="text-2xl font-semibold tracking-tight">Local SEO</h1><p className="text-sm text-muted-foreground">Acompanhe a visibilidade local por palavra-chave e região.</p></header>
    {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
    <Card><CardHeader><CardTitle className="text-base">Nova grade de presença</CardTitle></CardHeader><CardContent><form onSubmit={startRun} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"><Input aria-label="Palavra-chave" placeholder="Ex.: dentista" value={keyword} onChange={(event) => setKeyword(event.target.value)} required /><Input aria-label="Negócio-alvo" placeholder="Nome no Google Maps" value={targetBusinessName} onChange={(event) => setTargetBusinessName(event.target.value)} required /><Input aria-label="Latitude" type="number" step="any" placeholder="Latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} required /><Input aria-label="Longitude" type="number" step="any" placeholder="Longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} required /><Button type="submit" disabled={busy}>{busy ? "Enfileirando…" : "Iniciar grade"}</Button></form></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Execuções recentes</CardTitle></CardHeader><CardContent>{runs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p> : <ul className="divide-y">{runs.map((run) => <li key={run.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span>{run.local_keywords?.keyword ?? "Palavra-chave"} · grade {run.grid_size}×{run.grid_size}</span><span className="flex items-center gap-3 text-muted-foreground">{run.status} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(run.created_at))}<Button type="button" variant="outline" size="sm" onClick={() => void openRun(run.id)}>Ver mapa</Button></span></li>)}</ul>}</CardContent></Card>
    {detail && <Card><CardHeader><CardTitle className="text-base">Mapa de calor · {detail.run.local_keywords?.keyword ?? "execução"}</CardTitle></CardHeader><CardContent className="space-y-4">{detail.run.status === "completed" && detail.points.length > 0 && detail.points.every((point) => point.position === null) && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">A execução encontrou os pontos, mas o provider de ranking não retornou posições. Nenhum ranking foi inferido ou preenchido artificialmente.</p>}<div className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span>Média: {detail.metrics.averagePosition ?? "—"}</span><span>Melhor: {detail.metrics.bestPosition ?? "—"}</span><span>Pior: {detail.metrics.worstPosition ?? "—"}</span><span>Top 10: {detail.metrics.top10Percent}%</span></div><div className="mx-auto grid max-w-lg gap-1" style={{ gridTemplateColumns: `repeat(${detail.run.grid_size}, minmax(0, 1fr))` }} aria-label="Mapa de posições locais">{detail.points.map((point) => <button key={point.id} type="button" title={`Posição ${point.position ?? "não encontrada"} · ${point.latitude}, ${point.longitude}`} className={`aspect-square rounded-md text-xs font-semibold ${band(point.position)}`} onClick={() => setMessage(`Ponto ${point.row_index + 1}, ${point.column_index + 1}: posição ${point.position ?? "não encontrada"}.`)}>{point.position ?? "—"}</button>)}</div><p className="text-xs text-muted-foreground">Verde indica posições até 3; amarelo até 10; laranja até 20; vermelho acima de 20. Pontos sem resultado permanecem neutros.</p></CardContent></Card>}
  </div>;
}
