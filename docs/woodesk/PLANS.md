# Planos e limites

O projeto já possui `plans` e `organizations.plan_id`. A migration `0239` adiciona `plan_entitlements` como configuração de capacidades e limites mensais, sem criar uma segunda assinatura. O catálogo canônico de chaves e rótulos fica em `lib/woodesk/plan-catalog.ts`.

O catálogo também cobre scoring, métricas do Google Business, GeoGrid/ranking local,
análise de concorrentes, Instagram Studio e calendário de marketing. Assim, uma
capability implementada não fica invisível para configuração de entitlement enquanto
um provider externo ainda estiver pendente.

Analytics operacional também é uma capability de plano e continua sujeito à feature
flag `analytics`, que permanece fechada por padrão.

Uma capacidade é permitida somente quando existe entitlement, ele está habilitado e o uso do mês está abaixo do limite. Ausência de plano/entitlement bloqueia a nova capacidade; isso mantém o core compatível sem liberar funcionalidades novas por acidente.

O enforcement deve ser chamado no backend antes de enfileirar Lead Finder, GeoGrid, voz, conteúdo ou campanhas. A UI apenas projeta o resultado e nunca é a fonte de autorização.
# Planos e entitlements

As chamadas outbound consultam `organizations.plan_id` e `plan_entitlements` com capability `voice_ai`, contando o uso desde o início do mês e bloqueando quando o entitlement está ausente, desabilitado ou excedido. O Lead Finder aplica a mesma regra com capability `lead_search`, o GeoGrid com `local_seo`, a geração de conteúdo com `content_generation`, o agendamento de campanhas com `campaign_execution` e a mensageria Instagram com `instagram_messaging`, antes de criar seus jobs ou drafts. O limite diário de proteção contra abuso continua separado do limite mensal do plano.

`GET /api/v1/woodesk/entitlements` expõe somente o catálogo de capacidades e limites do plano da organização autenticada para que a UI possa ocultar ou explicar recursos bloqueados.

Platform admins operam as flags por tenant em `GET/PUT /api/v1/admin/woodesk/feature-flags`.
A rota valida a chave contra `lib/woodesk/feature-flags.ts`, usa o client admin somente
após o guard MFA de platform admin e registra a alteração no audit log.
