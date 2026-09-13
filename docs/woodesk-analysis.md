# Woodesk Growth OS — análise inicial do DeskcommCRM

> Status: auditoria inicial executada em 2026-09-12. Este documento separa fatos confirmados por inspeção do checkout de decisões ainda dependentes de pesquisa externa, credenciais e validação de produto.

## Conclusão executiva

O DeskcommCRM já é o core operacional que o Woodesk Growth OS precisa: aplicação Next.js 16 com UI autenticada, Route Handlers versionados, Supabase/Postgres com RLS, CRM e pipeline, atendimento WhatsApp via WAHA, agenda, automações, agentes de IA, RAG, MCP, workers orientados por `event_log`, LGPD, white-label e kit self-host.

Portanto, a estratégia segura é evoluir por adapters, capacidades e módulos opcionais. Não há justificativa nesta fase para reescrever autenticação, CRM, pipeline, mensageria, agentes ou banco-base.

## Evidência do checkout

Confirmado por inspeção local:

| Área | Evidência encontrada | Decisão inicial |
|---|---|---|
| Frontend | App Router em `app/`, componentes em `components/`, Tailwind 4, Radix/shadcn e catálogo de navegação | Reaproveitar design system e shell; aplicar Woodesk por tokens e telas incrementais |
| Backend | Route Handlers em `app/api/v1/`, wrappers `ok()`/`fail()`, Zod, guards e auditoria | Adicionar APIs somente dentro dos contratos existentes |
| Banco | Supabase/Postgres, migrations versionadas e `supabase/baseline.sql` | Toda tabela nova deve ter migration, baseline idempotente, RLS e testes de isolamento |
| Auth/RBAC | Supabase Auth, `getUser()`, MFA opcional por política, papéis tenant e platform admin | Preservar integralmente |
| Multi-tenancy | `organization_id`, `fn_user_org_ids()` e invariantes de isolamento | Toda nova entidade/job/provider deve carregar organização explícita |
| CRM | Leads, contatos, empresas, funil/Kanban, atividades, tarefas, propostas e customer 360 | Estender; não criar CRM paralelo |
| Mensageria | Inbox, WAHA/NOWEB, webhooks, mídia em Storage, opt-out e anti-banimento | Criar interfaces de canal somente se houver provider adicional real |
| Agenda | Agenda interna, Google Calendar/Meet, disponibilidade, follow-up e lembretes | Reaproveitar para reuniões e automações |
| IA | Agent Engine, providers LLM, guardrails, RAG/pgvector, workers, budget e MCP | Ampliar via registry/orquestração existente |
| Automação | Regras QUANDO/SE/ENTÃO, `event_log`, cron routes e workers | Usar jobs assíncronos, idempotência e eventos |
| Observabilidade | Logger estruturado, Sentry, métricas do agent engine e audit log | Reusar; acrescentar dimensões de provider/capability quando necessário |
| White-label | Branding resolvido do banco e tokens de marca | Woodesk deve ser uma configuração de marca, não uma quebra do white-label |
| Deploy | Docker, scheduler/worker images, self-host kit e gates de packaging | Não adicionar scraping/browser ao request principal |

Contagens observadas neste checkout: 301 arquivos sob `app/api`, 216 arquivos SQL em `supabase/migrations`, 191 componentes TSX e 714 testes `*.test.ts(x)`. Essas contagens são apenas fotografia; comandos de medição devem continuar sendo a fonte da verdade.

## O que já funciona ou está substancialmente implementado

- Base multi-tenant com RLS, RBAC, auditoria e LGPD.
- CRM de contatos/leads, funis, Kanban, atividades, tarefas e propostas.
- Inbox/conversas com WhatsApp WAHA, webhooks, mídia e proteção de envio.
- Agenda com integração Google, disponibilidade e eventos remotos.
- Agentes de IA com RAG por organização, ferramentas MCP, classificação/sentimento, handoff e workers.
- Automação baseada em eventos, cron routes e filas leves usando `event_log`.
- Branding/white-label no banco, documentação de self-host e Docker.

## Lacunas do escopo Woodesk que ainda não foram confirmadas no código

Estas são capacidades do prompt que não devem ser declaradas como implementadas sem uma auditoria específica:

- Lead Finder oficial e assíncrono para fontes de mapas.
- Enriquecimento, score de oportunidade e diagnóstico de presença digital.
- Google Business Profile Performance API por OAuth de tenant.
- Local SEO, GeoGrid, histórico de ranking e concorrentes.
- Instagram Messaging/Content via Meta Graph API.
- VoiceProvider com pipeline de voz em tempo real.
- Orquestrador formal de subagentes com limites por tenant.
- Calendário editorial e campanhas multicanal.
- Métricas de custo de IA por agente/tenant/canal.
- Planos/entitlements específicos do Woodesk.

Cada item deve virar uma capability com provider, feature flag, job assíncrono, contrato, migration e testes — não uma tela demonstrativa com dados fixos.

## Arquitetura de evolução proposta

```text
UI existente Woodesk
        ↓
Application services do domínio
        ↓
Capability/Provider registry
        ↓
Jobs e workers assíncronos (event_log + Redis quando aprovado)
        ↓
APIs oficiais ou adapters externos
        ↓
Eventos, auditoria, métricas e atualização do CRM
```

Regras estruturais:

1. O domínio existente continua sendo a fonte de verdade.
2. Providers não gravam payload externo diretamente em tabelas de produto.
3. Operações longas não rodam dentro de request HTTP.
4. Credenciais ficam no servidor/vault existente, nunca no frontend ou logs.
5. Scraping/browser automation só entra com termos, licença, limites e isolamento revisados.
6. Feature flags devem desligar uma integração sem remover o core.

## Plano de migração por fases

### Fase 0 — auditoria e contratos

Completar inventário de módulos, banco, rotas e navegação; registrar decisões e riscos; definir contratos de provider e capability; verificar licenças e termos das fontes externas.

### Fase 1 — identidade e shell

Aplicar tokens/nome Woodesk sem remover white-label, preservando navegação e fluxos existentes. Validar com testes de branding, navegação e E2E visual.

### Fase 2 — CRM refinado

Reusar pipeline/Kanban e adicionar apenas campos/capacidades comprovadamente ausentes, com migration compatível e isolamento tenant.

### Fase 3 — Lead Finder

Implementar provider permitido e job assíncrono, normalização, deduplicação, enriquecimento e score. Não ativar scraping em produção sem revisão jurídica/técnica.

### Fase 4 — Google Business e Local SEO

Priorizar APIs oficiais/OAuth; modelar métricas, keywords, rankings e GeoGrid com snapshots idempotentes.

### Fase 5 — agentes, voz e canais

Ampliar o Tool Registry e o Agent Engine; adicionar voz/Instagram apenas atrás de providers e feature flags, preservando WAHA.

### Fase 6 — marketing, analytics e entitlements

Unificar timeline, conteúdo, campanhas, custos e limites de plano usando as entidades CRM existentes sempre que possível.

## Riscos principais

- Scraping de Google Maps/Jusbrasil pode violar termos, sofrer bloqueio e carregar risco jurídico; API oficial ou integração autorizada deve ser preferida.
- Browser automation e WhatsMeow exigem isolamento de processo/credenciais e não podem entrar no handler principal.
- Novas tabelas tenant-aware podem criar vazamento se handlers com service role não filtrarem `organization_id` manualmente.
- O checkout possui documentação de estado datada; contagens e gates devem ser revalidados antes de cada conclusão.
- A execução completa do prompt exige credenciais externas, decisões de produto e validação de produção; não é honesto tratá-la como concluída em uma única alteração local.

## Próximo incremento seguro

O próximo incremento recomendado é criar o contrato interno de `CapabilityProvider` e um registry de integrações sem acoplar a UI a nenhum repositório externo. Depois disso, implementar uma única capacidade vertical, preferencialmente Lead Finder baseado em fonte autorizada, com migration, job, normalização, RLS, feature flag e testes.

## Verificação usada

- Leitura de `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `docs/current-state.md` e `package.json`.
- Inventário local de `app/api`, migrations, componentes e testes.
- Inspeção de diretórios `app`, `lib`, `workers`, `supabase` e documentação existente.

Ainda não foram baixados nem incorporados repositórios externos, nem executados `typecheck`, `lint` ou a suíte completa nesta etapa de auditoria documental.
