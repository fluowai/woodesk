# Roadmap de implementação do Growth OS

Este roadmap é um mapa de evidência, não uma promessa de prazo. Cada fase só pode ser marcada como concluída quando tiver código, persistência quando necessária, teste proporcional e verificação compatível com o escopo.

## Fase 1 — fundação preservada

- [x] Feature flags e capability registry.
- [x] Migrations tenant-aware com RLS e apêndices no baseline.
- [x] Dashboard inicial, health operacional e navegação canônica.
- [x] Evolução diária tenant-aware no dashboard, com tabela responsiva acessível.
- [x] Gráfico CSS acessível de leads por dia usando a mesma série real do dashboard.
- [x] Jobs duráveis registrados no worker existente.

## Fase 2 — aquisição e inteligência local

- [x] Lead Finder com busca assíncrona, filtros, diagnóstico, enrichment, rejeição e importação explícita.
- [x] Google Places oficial com field mask e provider desabilitado sem chave.
- [x] GeoGrid com snapshots, métricas e mapa de calor.
- [ ] Provider de ranking avançado, quando houver contrato oficial e credencial configurada.

## Fase 3 — operação de marketing

- [x] Conteúdo com aprovação, mídia HTTPS, calendário e publicação delegada.
- [x] Instagram Graph adapter e worker com OAuth resolvido pelo core.
- [x] Campanhas com revisão, aprovação, agendamento e adapter HTTP injetável.
- [ ] Provisionar credenciais reais e adapters de entrega por canal.

## Fase 4 — agentes e canais avançados

- [x] Orquestração com delegação para enrichment, scoring, campanhas, GeoGrid, Google Business e voz.
- [x] Guardrails de voz e contrato de provider Pipecat/Voicebox.
- [x] Executor de `content_generation` cria rascunhos persistidos e sempre exige aprovação.
- [x] Executor de `instagram_messaging` delega respostas autenticadas para a fila `instagram_reply`.
- [x] Papel `customer_success` pode delegar `campaign_execution` pelo orquestrador existente.
- [ ] Capability específica de Customer Success (retenção/cadência própria) — depende de contrato de negócio, evento de disparo e política de consentimento.
- [ ] Provisionar provider de voz e validar consentimento/telemetria em ambiente real.

## Fase 5 — comercial e escala

- [x] Propostas, aceite público com token hash/expiração e movimentação opcional no pipeline.
- [x] Timeline omnichannel integrada ao dossiê de contato.
- [x] Entitlements e enforcement mensal nas capacidades novas.
- [x] Fundação de medição central idempotente por capability (`woodesk_usage_events`).
- [x] Endpoint e painel inicial de consumo mensal por capability.
- [x] Histórico inicial de seis buckets mensais de consumo.
- [x] Edição server-side de propostas em rascunho, com recálculo e bloqueio após envio.
- [x] Metas operacionais com período explícito, criação/edição/remoção protegidas por gestor, API tenant-aware e leitura/progresso no dashboard.
- [x] Notificações transacionais persistidas, leitura/marcação e eventos de propostas.

## Gate de cada fase

1. `pnpm typecheck` e `pnpm lint` sem erros.
2. `pnpm test:unit` verde.
3. `pnpm test:db` quando houver schema/RLS/tenant scope.
4. `pnpm test:e2e` e evidência visual quando houver UI ou jornada de usuário.
5. `pnpm gov:verify` não substitui os gates de banco e E2E.

No ambiente atual, `typecheck`, ESLint sem erros bloqueantes, `build`, a suíte
focada Woodesk (37 arquivos/103 testes) e os gates estruturais do baseline
(5 arquivos/20 testes) foram executados com sucesso. `test:db` permanece
bloqueado neste Windows gerenciado porque depende de Bash e Docker; E2E e a
jornada de instalação fresca ainda exigem ambiente preparado. As caixas não
marcadas acima são dependências reais de provider ou de contrato de negócio,
não falhas ocultas de verificação local.
