"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Result = { id: string; name: string; category: string | null; city: string | null; rating: number | null; review_count?: number | null; website: string | null; status: string; lead_enrichment?: { score?: number | null; score_band?: string | null } | null };
type Diagnostic = { score: number; scoreBand: string; problems: string[]; opportunities: string[]; pitch: string };
type ImportTarget = { pipelineId: string; stageId: string; stages: Array<{ id: string; name: string }> };

export function LeadFinderClient() {
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [minRating, setMinRating] = useState("");
  const [minReviews, setMinReviews] = useState("");
  const [onlyWithWebsite, setOnlyWithWebsite] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [diagnostics, setDiagnostics] = useState<Record<string, Diagnostic>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importTarget, setImportTarget] = useState<ImportTarget | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  async function loadResults() {
    const response = await fetch("/api/v1/lead-finder/results", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("results_failed");
    const payload = await response.json() as { data?: { results?: Result[] } };
    setResults(payload.data?.results ?? []);
  }

  useEffect(() => {
    void Promise.all([loadResults(), fetch("/api/v1/pipelines/default").then(async (response) => response.ok ? response.json() as Promise<{ data?: { pipeline?: { id: string }; stages?: Array<{ id: string; name: string }> } }> : null)])
      .then(([, payload]) => { const pipeline = payload?.data?.pipeline; const stages = payload?.data?.stages ?? []; if (pipeline && stages[0]) setImportTarget({ pipelineId: pipeline.id, stageId: stages[0].id, stages }); })
      .catch(() => setMessage("Não foi possível carregar os resultados."));
  }, []);

  const visibleResults = results.filter((result) =>
    (!minRating || (result.rating ?? 0) >= Number(minRating)) &&
    (!minReviews || (result.review_count ?? 0) >= Number(minReviews)) &&
    (!onlyWithWebsite || Boolean(result.website))
  );

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/v1/lead-finder/searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider_id: "browser_import", keyword, city, limit: 25 }) });
      if (!response.ok) throw new Error("search_failed");
      setMessage("Busca enfileirada. Os resultados aparecerão quando o processamento terminar.");
      await loadResults();
    } catch { setMessage("Use o extractor de navegador e importe o CSV/JSON para alimentar esta busca."); }
    finally { setBusy(false); }
  }

  async function diagnose(id: string) {
    const response = await fetch(`/api/v1/lead-finder/results/${id}/diagnostic`, { method: "POST" });
    if (!response.ok) { setMessage("Não foi possível gerar o diagnóstico."); return; }
    const payload = await response.json() as { data?: { diagnostic?: Diagnostic } };
    if (payload.data?.diagnostic) setDiagnostics((current) => ({ ...current, [id]: payload.data!.diagnostic! }));
  }

  async function reject(id: string) {
    const response = await fetch(`/api/v1/lead-finder/results/${id}/reject`, { method: "POST" });
    setMessage(response.ok ? "Resultado rejeitado." : "Não foi possível rejeitar o resultado.");
    if (response.ok) await loadResults();
  }

  async function importResult(id: string) {
    if (!importTarget) { setMessage("Nenhum funil padrão está configurado."); return; }
    const response = await fetch(`/api/v1/lead-finder/results/${id}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pipeline_id: importTarget.pipelineId, stage_id: importTarget.stageId }) });
    setMessage(response.ok ? "Resultado importado para o CRM." : "Não foi possível importar o resultado.");
    if (response.ok) await loadResults();
  }

  async function rejectSelected() {
    if (selected.length === 0) return;
    const response = await fetch("/api/v1/lead-finder/results/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", result_ids: selected }) });
    setMessage(response.ok ? `${selected.length} resultado(s) enviados para rejeição.` : "Não foi possível rejeitar os resultados selecionados.");
    if (response.ok) { setResults((current) => current.map((result) => selected.includes(result.id) ? { ...result, status: "rejected" } : result)); setSelected([]); }
  }

  async function importSelected() {
    if (selected.length === 0 || !importTarget) return;
    const response = await fetch("/api/v1/lead-finder/results/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", result_ids: selected, pipeline_id: importTarget.pipelineId, stage_id: importTarget.stageId }) });
    const payload = await response.json().catch(() => ({})) as { data?: { imported?: number } };
    setMessage(response.ok ? `${payload.data?.imported ?? 0} resultado(s) importado(s) no CRM.` : "Não foi possível importar os resultados selecionados.");
    if (response.ok) { setResults((current) => current.map((result) => selected.includes(result.id) ? { ...result, status: "imported" } : result)); setSelected([]); }
  }

  return <div className="flex h-full flex-col gap-6 p-6">
    <header><h1 className="text-2xl font-semibold tracking-tight">Lead Finder</h1><p className="text-sm text-muted-foreground">Encontre empresas e transforme sinais públicos em oportunidades comerciais.</p></header>
    <Card><CardHeader><CardTitle className="text-base">Nova busca</CardTitle></CardHeader><CardContent><form onSubmit={search} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Input aria-label="Segmento ou palavra-chave" placeholder="Ex.: clínica odontológica" value={keyword} onChange={(event) => setKeyword(event.target.value)} required /><Input aria-label="Cidade" placeholder="Cidade" value={city} onChange={(event) => setCity(event.target.value)} required /><Button type="submit" disabled={busy}>{busy ? "Enfileirando…" : "Buscar"}</Button></form>{message && <p className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Filtros e destino de importação</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-center"><Input aria-label="Nota mínima" type="number" min="0" max="5" step="0.1" placeholder="Nota mínima" value={minRating} onChange={(event) => setMinRating(event.target.value)} /><Input aria-label="Avaliações mínimas" type="number" min="0" step="1" placeholder="Avaliações mínimas" value={minReviews} onChange={(event) => setMinReviews(event.target.value)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyWithWebsite} onChange={(event) => setOnlyWithWebsite(event.target.checked)} /> Com site</label>{importTarget ? <select aria-label="Etapa de importação" className="h-10 rounded-md border bg-background px-3 text-sm" value={importTarget.stageId} onChange={(event) => setImportTarget({ ...importTarget, stageId: event.target.value })}>{importTarget.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select> : <span className="text-xs text-muted-foreground">Configure um funil para importar.</span>}</CardContent></Card>
    <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{selected.length} selecionado(s)</span><div className="flex gap-2"><Button type="button" disabled={selected.length === 0 || !importTarget} onClick={() => void importSelected()}>Importar selecionados</Button><Button type="button" variant="outline" disabled={selected.length === 0} onClick={() => void rejectSelected()}>Rejeitar selecionados</Button></div></div><section aria-label="Resultados" className="grid gap-4 lg:grid-cols-2">{visibleResults.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum resultado corresponde aos filtros atuais.</CardContent></Card> : visibleResults.map((result) => <Card key={result.id}><CardHeader><CardTitle className="flex items-start justify-between gap-3 text-base"><span className="flex min-w-0 items-center gap-2 break-words"><input aria-label={`Selecionar ${result.name}`} type="checkbox" checked={selected.includes(result.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, result.id] : current.filter((id) => id !== result.id))} />{result.name}</span><span className="shrink-0 text-sm font-normal text-muted-foreground">{result.rating ?? "—"} ★</span></CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="text-muted-foreground">{[result.category, result.city].filter(Boolean).join(" · ") || "Sem categoria informada"}</p><p>{result.website ? "Site identificado" : "Sem site identificado"} · {result.review_count ?? 0} avaliações · status: {result.status}</p><span className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => void diagnose(result.id)}>Gerar diagnóstico</Button>{result.status === "new" || result.status === "duplicate" ? <><Button type="button" onClick={() => void importResult(result.id)} disabled={!importTarget}>Importar no CRM</Button><Button type="button" variant="outline" onClick={() => void reject(result.id)}>Rejeitar</Button></> : null}</span>{diagnostics[result.id] && <div className="rounded-md border p-3"><p className="font-medium">Score {diagnostics[result.id]!.score} · {diagnostics[result.id]!.scoreBand}</p><p className="mt-1 text-muted-foreground">{diagnostics[result.id]!.pitch}</p>{diagnostics[result.id]!.opportunities.length > 0 && <p className="mt-2">Oportunidades: {diagnostics[result.id]!.opportunities.join("; ")}</p>}</div>}</CardContent></Card>)}</section>
  </div>;
}
