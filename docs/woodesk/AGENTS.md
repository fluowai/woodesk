# Orquestrador de agentes

O Woodesk não cria um segundo runtime de IA. `lib/woodesk/orchestrator.ts` apenas valida o papel, a capability e o tenant antes de planejar um job. A execução permanece no Agent Engine e na fila existente.

Cada tarefa deve carregar `organizationId`, capability, entrada mínima e se exige aprovação humana. Ações externas — publicação, envio outbound, ligação, alteração de pipeline ou criação de proposta — devem ser explicitamente aprovadas conforme os guardrails existentes.
# Orquestração

`POST /api/v1/woodesk/agents/tasks/plan` valida papel/capability e devolve um plano `queued` sem iniciar execução. A feature flag `agent_orchestrator` protege a superfície; execução real e tools específicas continuam delegadas ao runtime existente.

A migration `0242` persiste `agent_tasks` com RLS e o job `agent_task`. Até existir executor/provider para uma capability, o worker encerra a tarefa com `agent_executor_not_configured` em vez de fingir sucesso.

`GET /api/v1/woodesk/agents/tasks` lista tarefas do tenant e aceita filtro por status.

`POST /api/v1/woodesk/agents/tasks/:id/cancel` cancela tarefas ainda `queued` sem remover o histórico.
