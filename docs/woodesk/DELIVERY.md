# Entrega Woodesk Growth OS

Este documento é o inventário operacional da transformação. Ele distingue o que
está confirmado por código do que ainda depende de provider, ambiente ou gate de
verificação.

## Reaproveitado do DeskcommCRM

- autenticação, `requireRole`, clientes Supabase e RLS;
- contatos, conversas, mensagens, atividades, agenda, funil e propostas;
- fila durável `job_queue`, workers e `event_log`;
- runtime de agentes e seam único `runModelCall`;
- OAuth Google existente, WAHA/WhatsApp e auditoria;
- wrappers de API, logging estruturado e mecanismos LGPD/white-label.

## Criado ou modificado

- módulos Woodesk em `lib/woodesk/` para Lead Finder, enrichment, Local SEO,
  GeoGrid, Google Business, Voice, Marketing, Instagram, analytics, planos,
  metas, notificações e dashboard;
- UI autenticada em `app/app/woodesk/` e superfícies administrativas;
- rotas versionadas em `app/api/v1/woodesk/` e Lead Finder;
- workers duráveis registrados em `workers/agent-worker/main.ts`;
- documentação completa em `docs/woodesk/`;
- integração server-side configurável para Voice e entrega de campanhas;
- geração de conteúdo pelo seam oficial de IA, sempre como rascunho com aprovação.
- importação `browser_import` de CSV/JSON produzido pelos extractors de navegador,
  sem API Google Places no fluxo de Lead Finder.

## Inventário da entrega

### Arquivos e superfícies criadas

- `app/app/woodesk/` — dashboard, metas, notificações, propostas, campanhas,
  conteúdo, Instagram e operações de aquisição;
- `app/admin/(protected)/woodesk/` — controles administrativos de capabilities;
- `app/api/v1/woodesk/` — 39 handlers versionados;
- `app/api/v1/lead-finder/` — 8 handlers de busca, importação, resultados e enrichment;
- `app/api/v1/webhooks/instagram/` e `app/api/v1/public/` — entradas externas
  explicitamente limitadas ao fluxo correspondente;
- `lib/woodesk/` — contratos, entitlement, analytics, providers, health,
  scoring, timeline e regras de domínio;
- workers e testes unitários/contratuais correspondentes.

### Serviços e dependências

Foram reutilizados os clientes Supabase, o runtime `runModelCall`, WAHA,
OAuth Google, fila `job_queue`, workers e wrappers de API. As integrações
externas novas são adapters server-side para Google Places/Business, Meta
Graph, Voice/Pipecat e entrega de campanhas; nenhum token é enviado ao browser.

### Variáveis de ambiente

Além das variáveis existentes, os adapters opcionais usam:

`VOICE_PROVIDER`, `VOICE_PROVIDER_BASE_URL`, `VOICE_PROVIDER_TOKEN`,
`CAMPAIGN_PROVIDER_ID`, `CAMPAIGN_PROVIDER_BASE_URL` e
`CAMPAIGN_PROVIDER_TOKEN`. Todas estão espelhadas em `.env.example`.
Voice pode permanecer sem provider/token; nesse estado a capability fica
indisponível sem impedir o boot.

### Fluxo coberto e lacunas

O fluxo Google Maps → lead → enrichment → scoring → CRM → agentes → canais →
agenda → proposta → follow-up → marketing está representado por rotas,
persistência e jobs duráveis. A execução em produção ainda depende de
credenciais/providers de ranking, voz, e-mail e entrega de campanhas; retenção
Customer Success e publicação de caption/script permanecem sem contrato de
negócio explícito.

## Banco e migrations

As migrations Woodesk `0233`–`0258` estão versionadas em
`supabase/migrations/`, listadas em `supabase/migrations/MANIFEST.md` e
representadas como apêndices idempotentes em `supabase/baseline.sql`.
As migrations de planos/WAHA já existentes foram normalizadas para `0260` e
`0261`, também presentes no manifest e no baseline.

Toda alteração futura de schema deve manter os três artefatos sincronizados e
nunca editar migration já aplicada.

## Variáveis novas

- `VOICE_PROVIDER`, `VOICE_PROVIDER_BASE_URL`, `VOICE_PROVIDER_TOKEN`;
- `CAMPAIGN_PROVIDER_ID`, `CAMPAIGN_PROVIDER_BASE_URL`,
  `CAMPAIGN_PROVIDER_TOKEN`.

As variáveis são opcionais para permitir boot sem provider; quando incompletas,
as capabilities ficam indisponíveis de forma explícita.

## Comandos de verificação

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:unit
corepack pnpm test:db
corepack pnpm test:e2e
corepack pnpm build
```

`test:db` exige Docker; `test:e2e` exige aplicação e banco preparados. No
ambiente desta entrega, `typecheck`, ESLint sem erros bloqueantes e `build`
passaram. A suíte focada Woodesk passou com 37 arquivos/103 testes; a suíte
estrutural do baseline passou com 5 arquivos/20 testes. A suíte global de
unitários terminou com 8.094 testes aprovados e 75 falhas fora do escopo
Woodesk, registradas em `STATUS.md`. `test:db` permanece não executável neste
Windows gerenciado porque o script depende de Bash e Docker não está disponível;
`test:e2e` e a jornada de instalação fresca ainda exigem ambiente preparado.

## Confirmado

- isolamento tenant-aware nas superfícies Woodesk auditadas;
- feature flags nas capabilities operacionais;
- entitlement mensal em execuções monetizáveis;
- publicação Instagram somente por worker e após aprovação;
- tokens de providers mantidos server-side;
- auditoria estática de marca legada, migrations e whitespace realizada.

## Riscos e pendências

- providers externos de Voice, campanhas, ranking avançado e enriquecimento
  precisam ser provisionados e testados em ambiente real;
- caption/script Instagram continuam artefatos de rascunho;
- alguns dashboards avançados e retenção específica de Customer Success ainda
  dependem de contrato de negócio explícito;
- gates de banco, E2E e instalação fresca ainda precisam ser executados em
  ambiente Linux/Docker funcional;
- a jornada de instalação fresca deve ser validada separadamente do E2E comum.
