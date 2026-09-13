# Banco de dados Woodesk

O banco do Woodesk é uma extensão do schema existente. Cada tabela nova possui `organization_id`, RLS e índices tenant-aware.

## Módulos adicionados

- Lead Finder: `lead_finder_searches`, `lead_finder_results`, `lead_enrichment`.
- Local SEO: `local_keywords`, `local_grid_runs`, `local_grid_points`, `local_competitors`.
  `local_keywords.target_business_name` identifica o negócio avaliado; sem ele o worker não atribui posição.
- Google Business: `google_business_locations`, `google_business_metrics`.
- Voz: `voice_calls`, `voice_transcripts`.
- Conteúdo e marketing: `marketing_contents`, `content_calendar_items`, `marketing_campaigns`.
- Instagram: `instagram_accounts`, com uma conta por organização/provider, token em `access_token_encrypted` e estado de expiração.
- Comercial: `commercial_proposals`, `commercial_proposal_items`.
- Operação: `agent_tasks`, `woodesk_usage_events`, `woodesk_goals`, `woodesk_notifications`.
- Configuração: `feature_flags`.

## Compatibilidade

As migrations são aditivas e versionadas. O `supabase/baseline.sql` contém um apêndice idempotente para instalações novas. O código existente continua sendo a fonte de verdade para contatos, conversas, pipeline, agentes, auditoria, OAuth e filas.

Não editar migrations já aplicadas. Qualquer correção futura deve ser uma nova migration e também atualizar o baseline e o manifesto.

## Segurança

Tokens OAuth ficam cifrados em repouso nas tabelas canônicas de conexão (`instagram_accounts` e conexões existentes), nunca em JSON de negócio ou no navegador. A coluna secreta tem acesso revogado para `authenticated`; decifração ocorre apenas no servidor/worker via `fn_decrypt_oauth`. Toda consulta com service role deve aplicar o filtro explícito de organização.

As metas exigem métrica, alvo e período explícitos. Notificações transacionais possuem chave de idempotência por organização para sobreviver a retries sem duplicação, e os recibos de leitura ficam separados por usuário (`woodesk_notification_reads`).
