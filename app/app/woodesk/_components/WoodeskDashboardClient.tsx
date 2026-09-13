"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WOODESK_CAPABILITY_LABELS } from "@/lib/woodesk/plan-catalog";

type Metric = { value: number; previousValue: number; changePercent: number | null };
type Metrics = {
  leadsFound: Metric;
  meetingsScheduled: Metric;
  opportunities: Metric;
  salesCents: Metric;
  contentsGenerated: Metric;
  voiceCalls: Metric;
};
type Activity = { id: string; type: string; reason: string | null; source_module: string | null; performed_at: string };
type DashboardPayload = { metrics?: Metrics; recent_activity?: Activity[]; alerts?: { failed_jobs: number } };
type TrendPoint = { date: string; leadsFound: number; meetingsScheduled: number; opportunities: number; contentsGenerated: number; voiceCalls: number; salesCents: number };
type CapabilityHealth = { enabled: boolean; status: string };
type Goal = { id: string; metric: "leads_found" | "appointments" | "opportunities" | "sales_cents" | "contents_generated" | "voice_calls"; target: number; current?: number; period_start: string; period_end: string; label: string };
type Notification = { id: string; title: string; body: string; read_at: string | null; created_at: string };
type Entitlement = { capability: string; enabled: boolean; monthly_limit: number | null; config?: Record<string, unknown> };
type AiCosts = { tokens: number; cost_cents: number; by_agent: Record<string, { tokens: number; cost_cents: number }>; by_provider: Record<string, { tokens: number; cost_cents: number }>; by_conversation: Record<string, { tokens: number; cost_cents: number }> };

const LABELS: ReadonlyArray<[keyof Metrics, string]> = [
  ["leadsFound", "Leads encontrados"],
  ["meetingsScheduled", "Reuniões agendadas"],
  ["opportunities", "Oportunidades"],
  ["salesCents", "Vendas"],
  ["contentsGenerated", "Conteúdos gerados"],
  ["voiceCalls", "Ligações IA"],
];

const GOAL_METRIC_KEYS: Record<Goal["metric"], keyof Metrics> = {
  leads_found: "leadsFound",
  appointments: "meetingsScheduled",
  opportunities: "opportunities",
  sales_cents: "salesCents",
  contents_generated: "contentsGenerated",
  voice_calls: "voiceCalls",
};

function formatValue(key: keyof Metrics, value: number): string {
  if (key === "salesCents") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
  }
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function WoodeskDashboardClient() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [failedJobs, setFailedJobs] = useState(0);
  const [capabilities, setCapabilities] = useState<Record<string, CapabilityHealth>>({});
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [usageHistory, setUsageHistory] = useState<Record<string, Record<string, number>>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalLabel, setGoalLabel] = useState("");
  const [goalMetric, setGoalMetric] = useState<Goal["metric"]>("leads_found");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalStart, setGoalStart] = useState("");
  const [goalEnd, setGoalEnd] = useState("");
  const [goalMessage, setGoalMessage] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [plan, setPlan] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [aiCosts, setAiCosts] = useState<AiCosts | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/v1/woodesk/dashboard", { headers: { Accept: "application/json" } }), fetch("/api/v1/woodesk/health", { headers: { Accept: "application/json" } }), fetch("/api/v1/woodesk/usage", { headers: { Accept: "application/json" } }), fetch("/api/v1/woodesk/goals", { headers: { Accept: "application/json" } }), fetch("/api/v1/woodesk/notifications", { headers: { Accept: "application/json" } }), fetch("/api/v1/woodesk/entitlements", { headers: { Accept: "application/json" } }), fetch("/api/v1/woodesk/ai-costs", { headers: { Accept: "application/json" } })])
      .then(async ([dashboardResponse, healthResponse, usageResponse, goalsResponse, notificationsResponse, entitlementsResponse, aiCostsResponse]) => {
        if (!dashboardResponse.ok) throw new Error("dashboard_request_failed");
        const payload = (await dashboardResponse.json()) as { data?: DashboardPayload & { trend?: TrendPoint[] } };
        const health = healthResponse.ok ? await healthResponse.json() as { data?: { capabilities?: Record<string, CapabilityHealth> } } : null;
        const usagePayload = usageResponse.ok ? await usageResponse.json() as { data?: { usage?: Record<string, number>; history?: Record<string, Record<string, number>> } } : null;
        const goalsPayload = goalsResponse.ok ? await goalsResponse.json() as { data?: { goals?: Goal[] } } : null;
        const notificationsPayload = notificationsResponse.ok ? await notificationsResponse.json() as { data?: { notifications?: Notification[] } } : null;
        const entitlementsPayload = entitlementsResponse.ok ? await entitlementsResponse.json() as { data?: { plan_id?: string | null; entitlements?: Entitlement[] } } : null;
        const aiCostsPayload = aiCostsResponse.ok ? await aiCostsResponse.json() as { data?: AiCosts } : null;
        if (active) {
          setMetrics(payload.data?.metrics ?? null);
          setActivity(payload.data?.recent_activity ?? []);
          setFailedJobs(payload.data?.alerts?.failed_jobs ?? 0);
          setCapabilities(health?.data?.capabilities ?? {});
          setUsage(usagePayload?.data?.usage ?? {});
          setUsageHistory(usagePayload?.data?.history ?? {});
          setGoals(goalsPayload?.data?.goals ?? []);
          setNotifications(notificationsPayload?.data?.notifications ?? []);
          setTrend(payload.data?.trend ?? []);
          setPlan(entitlementsPayload?.data?.plan_id ?? null);
          setEntitlements(entitlementsPayload?.data?.entitlements ?? []);
          setAiCosts(aiCostsPayload?.data ?? null);
        }
      })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  async function createGoal(event: FormEvent) {
    event.preventDefault(); setGoalMessage(null);
    const editing = Boolean(editingGoalId);
    const response = await fetch(editing ? `/api/v1/woodesk/goals?id=${encodeURIComponent(editingGoalId as string)}` : "/api/v1/woodesk/goals", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: goalLabel, metric: goalMetric, target: Number(goalTarget), period_start: goalStart, period_end: goalEnd }) });
    if (!response.ok) { setGoalMessage("Não foi possível criar a meta. Verifique os dados e sua permissão."); return; }
    const payload = await response.json() as { data?: Goal };
    if (payload.data) setGoals((current) => editing ? current.map((goal) => goal.id === payload.data?.id ? payload.data as Goal : goal) : [payload.data as Goal, ...current]);
    setGoalLabel(""); setGoalTarget(""); setEditingGoalId(null); setGoalMessage(editing ? "Meta atualizada." : "Meta criada.");
  }

  function editGoal(goal: Goal) { setEditingGoalId(goal.id); setGoalLabel(goal.label); setGoalMetric(goal.metric); setGoalTarget(String(goal.target)); setGoalStart(goal.period_start); setGoalEnd(goal.period_end); }
  function cancelGoalEdit() { setEditingGoalId(null); setGoalLabel(""); setGoalTarget(""); setGoalStart(""); setGoalEnd(""); }

  async function deleteGoal(id: string) {
    const response = await fetch(`/api/v1/woodesk/goals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) { setGoalMessage("Não foi possível remover a meta."); return; }
    setGoals((current) => current.filter((goal) => goal.id !== id)); setGoalMessage("Meta removida.");
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
        <p className="text-sm text-muted-foreground">Visão geral do crescimento da sua operação.</p>
      </header>
      {error ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Não foi possível carregar as métricas agora.</CardContent></Card>
      ) : !metrics ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando métricas...</CardContent></Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Métricas de crescimento">
            {LABELS.map(([key, label]) => {
              const metric = metrics[key];
              const change = metric.changePercent === null ? "—" : `${metric.changePercent >= 0 ? "+" : ""}${metric.changePercent.toFixed(1)}%`;
              return <Card key={key}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{formatValue(key, metric.value)}</p><p className="text-xs text-muted-foreground">{change} vs. período anterior</p></CardContent>
              </Card>;
            })}
          </section>
          <Card><CardHeader><CardTitle className="text-base">Metas</CardTitle></CardHeader><CardContent className="space-y-4"><form onSubmit={createGoal} className="grid gap-2 md:grid-cols-5"><input className="rounded-md border px-3 py-2 text-sm" aria-label="Nome da meta" placeholder="Nome da meta" value={goalLabel} onChange={(event) => setGoalLabel(event.target.value)} required /><select className="rounded-md border px-3 py-2 text-sm" aria-label="Métrica da meta" value={goalMetric} onChange={(event) => setGoalMetric(event.target.value as Goal["metric"])}><option value="leads_found">Leads encontrados</option><option value="appointments">Reuniões</option><option value="opportunities">Oportunidades</option><option value="sales_cents">Vendas (centavos)</option><option value="contents_generated">Conteúdos</option><option value="voice_calls">Ligações IA</option></select><input className="rounded-md border px-3 py-2 text-sm" aria-label="Alvo da meta" type="number" min="0.01" step="0.01" placeholder="Alvo" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} required /><input className="rounded-md border px-3 py-2 text-sm" aria-label="Início da meta" type="date" value={goalStart} onChange={(event) => setGoalStart(event.target.value)} required /><div className="flex gap-2"><input className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm" aria-label="Fim da meta" type="date" value={goalEnd} onChange={(event) => setGoalEnd(event.target.value)} required /><button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" type="submit">{editingGoalId ? "Salvar" : "Criar"}</button>{editingGoalId && <button className="rounded-md border px-3 py-2 text-sm" type="button" onClick={cancelGoalEdit}>Cancelar</button>}</div></form>{goalMessage && <p className="text-sm text-muted-foreground" role="status">{goalMessage}</p>}{goals.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma meta configurada para a operação.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{goals.map((goal) => { const metricKey = GOAL_METRIC_KEYS[goal.metric]; const current = goal.current ?? metrics[metricKey]?.value ?? 0; const percentage = Math.min(100, Math.round((current / goal.target) * 100)); return <div key={goal.id} className="rounded-md border p-3"><div className="flex items-start justify-between gap-2"><div className="font-medium">{goal.label}</div><div className="flex gap-2"><button type="button" className="text-xs" onClick={() => editGoal(goal)}>Editar</button><button type="button" className="text-xs text-destructive" onClick={() => void deleteGoal(goal.id)}>Remover</button></div></div><div className="mt-1 text-sm text-muted-foreground">{formatValue(metricKey, current)} de {formatValue(metricKey, goal.target)}</div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${percentage}%` }} /></div><div className="mt-1 text-xs text-muted-foreground">{percentage}% · {goal.period_start} a {goal.period_end}</div></div>; })}</div>}</CardContent></Card>
          <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]" aria-label="Operação recente">
            <Card>
              <CardHeader><CardTitle className="text-base">Atividade recente</CardTitle></CardHeader>
              <CardContent>
                {activity.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p> : <ul className="divide-y">
                  {activity.map((item) => <li key={item.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 break-words">{item.reason ?? item.type}{item.source_module ? ` · ${item.source_module}` : ""}</span>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.performed_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.performed_at))}</time>
                  </li>)}
                </ul>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Alertas operacionais</CardTitle></CardHeader>
              <CardContent><p className={failedJobs > 0 ? "text-2xl font-semibold text-destructive" : "text-2xl font-semibold"}>{failedJobs}</p><p className="text-sm text-muted-foreground">jobs com falha ou encerrados</p></CardContent>
            </Card>
          </section>
          <Card><CardHeader><CardTitle className="text-base">Evolução diária</CardTitle></CardHeader><CardContent>{trend.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados para o período selecionado.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Evolução diária das métricas</caption><thead><tr className="border-b"><th scope="col" className="px-2 py-2 font-medium">Dia</th><th scope="col" className="px-2 py-2 font-medium">Leads</th><th scope="col" className="px-2 py-2 font-medium">Reuniões</th><th scope="col" className="px-2 py-2 font-medium">Oportunidades</th><th scope="col" className="px-2 py-2 font-medium">Conteúdos</th><th scope="col" className="px-2 py-2 font-medium">Ligações</th><th scope="col" className="px-2 py-2 font-medium">Vendas</th></tr></thead><tbody>{trend.map((point) => <tr key={point.date} className="border-b last:border-0"><th scope="row" className="px-2 py-2 font-normal">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))}</th><td className="px-2 py-2">{point.leadsFound}</td><td className="px-2 py-2">{point.meetingsScheduled}</td><td className="px-2 py-2">{point.opportunities}</td><td className="px-2 py-2">{point.contentsGenerated}</td><td className="px-2 py-2">{point.voiceCalls}</td><td className="px-2 py-2">{formatValue("salesCents", point.salesCents)}</td></tr>)}</tbody></table></div>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Gráfico de leads por dia</CardTitle></CardHeader><CardContent>{trend.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados para o período selecionado.</p> : (() => { const maximum = Math.max(1, ...trend.map((point) => point.leadsFound)); return <div className="flex h-48 items-end gap-1 overflow-x-auto border-b border-l p-2" role="img" aria-label="Gráfico de leads encontrados por dia">{trend.map((point) => <div key={point.date} className="flex h-full min-w-5 flex-col justify-end" title={`${point.date}: ${point.leadsFound} leads`}><div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(2, (point.leadsFound / maximum) * 100)}%` }} /><span className="sr-only">{point.date}: {point.leadsFound} leads</span></div>)}</div>; })()}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Notificações</CardTitle></CardHeader><CardContent>{notifications.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma notificação recente.</p> : <ul className="divide-y">{notifications.slice(0, 5).map((notification) => <li key={notification.id} className={`flex items-start justify-between gap-3 py-3 text-sm ${notification.read_at ? "opacity-60" : ""}`}><div><div className="font-medium">{notification.title}</div><p className="text-muted-foreground">{notification.body}</p></div>{!notification.read_at && <button type="button" className="shrink-0 text-xs text-primary" onClick={() => void fetch("/api/v1/woodesk/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notification.id }) }).then(() => setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item)))}>Marcar como lida</button>}</li>)}</ul>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Capacidades da operação</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(capabilities).filter(([key]) => !["marketing", "instagram"].includes(key)).map(([key, value]) => <div key={key} className="rounded-md border p-3 text-sm"><div className="font-medium">{WOODESK_CAPABILITY_LABELS[key as keyof typeof WOODESK_CAPABILITY_LABELS] ?? key.replaceAll("_", " ")}</div><div className={value.status === "ready" ? "text-emerald-600" : value.status === "disabled" ? "text-muted-foreground" : "text-amber-600"}>{value.status}</div></div>)}</div>{Object.keys(capabilities).length === 0 && <p className="text-sm text-muted-foreground">Status de integrações indisponível no momento.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Consumo no mês</CardTitle></CardHeader><CardContent>{Object.keys(usage).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento de uso registrado neste mês.</p> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(usage).map(([key, value]) => <div key={key} className="rounded-md border p-3 text-sm"><div className="font-medium">{WOODESK_CAPABILITY_LABELS[key as keyof typeof WOODESK_CAPABILITY_LABELS] ?? key.replaceAll("_", " ")}</div><div className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(value)}</div><div className="text-xs text-muted-foreground">eventos</div></div>)}</div>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Custo de IA (USD)</CardTitle></CardHeader><CardContent>{!aiCosts || aiCosts.tokens === 0 ? <p className="text-sm text-muted-foreground">Nenhuma chamada de IA registrada no período.</p> : <div className="space-y-3"><div className="grid gap-2 sm:grid-cols-2"><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Tokens</div><div className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(aiCosts.tokens)}</div></div><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Custo em centavos de dólar</div><div className="text-lg font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(aiCosts.cost_cents / 100)}</div></div></div><div className="grid gap-2 md:grid-cols-3"><div><div className="mb-1 text-xs font-medium">Por agente</div>{Object.entries(aiCosts.by_agent).map(([key, value]) => <div className="flex justify-between text-sm" key={key}><span>{key}</span><span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value.cost_cents / 100)}</span></div>)}</div><div><div className="mb-1 text-xs font-medium">Por provider</div>{Object.entries(aiCosts.by_provider).map(([key, value]) => <div className="flex justify-between text-sm" key={key}><span>{key}</span><span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value.cost_cents / 100)}</span></div>)}</div><div><div className="mb-1 text-xs font-medium">Por conversa</div>{Object.entries(aiCosts.by_conversation).map(([key, value]) => <div className="flex justify-between text-sm" key={key}><span className="max-w-[12rem] truncate" title={key}>{key}</span><span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value.cost_cents / 100)}</span></div>)}</div></div></div>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Plano e capacidades</CardTitle></CardHeader><CardContent><p className="mb-3 text-sm text-muted-foreground">Plano ativo: <span className="font-medium text-foreground">{plan ?? "não configurado"}</span></p>{entitlements.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma capacidade foi liberada para esta organização.</p> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{entitlements.map((item) => <div key={item.capability} className="rounded-md border p-3 text-sm"><div className="font-medium">{WOODESK_CAPABILITY_LABELS[item.capability as keyof typeof WOODESK_CAPABILITY_LABELS] ?? item.capability.replaceAll("_", " ")}</div><div className={item.enabled ? "text-emerald-600" : "text-destructive"}>{item.enabled ? "Habilitado" : "Bloqueado"}</div><div className="text-xs text-muted-foreground">{item.monthly_limit === null ? "Sem limite mensal" : `${new Intl.NumberFormat("pt-BR").format(item.monthly_limit)} eventos/mês`}</div></div>)}</div>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Histórico de consumo</CardTitle></CardHeader><CardContent>{Object.keys(usageHistory).length === 0 ? <p className="text-sm text-muted-foreground">Sem histórico suficiente.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Eventos de uso do Growth OS por mês</caption><thead><tr className="border-b"><th scope="col" className="px-2 py-2 font-medium">Período</th><th scope="col" className="px-2 py-2 font-medium">Eventos</th></tr></thead><tbody>{Object.entries(usageHistory).sort(([left], [right]) => right.localeCompare(left)).map(([period, values]) => <tr key={period} className="border-b last:border-0"><td className="px-2 py-2">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${period}T00:00:00Z`))}</td><td className="px-2 py-2">{new Intl.NumberFormat("pt-BR").format(Object.values(values).reduce((total, value) => total + value, 0))}</td></tr>)}</tbody></table></div>}</CardContent></Card>
        </>
      )}
    </div>
  );
}
