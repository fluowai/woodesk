# Arquitetura Woodesk Growth OS

## Princípio

O core existente continua sendo a base: autenticação, organizações, RLS, CRM, funis, contatos, inbox, WAHA, agenda, agentes, RAG, MCP, automações, eventos e LGPD. Woodesk adiciona capacidades por adapters e workers, sem criar um segundo CRM.

```text
UI existente
  ↓
Application service
  ↓
Capability registry
  ↓
Provider autorizado
  ↓
Worker/job durável
  ↓
Snapshot normalizado + evento + auditoria
```

## Fronteiras

- `lib/woodesk/capabilities.ts` define capabilities, providers, prioridade e health check.
- `lib/woodesk/lead-finder.ts` e `lib/woodesk/local-seo.ts` são domínio puro e não fazem I/O.
- `lib/woodesk/google-business.ts` é adapter HTTP oficial e não grava banco.
- `lib/woodesk/google-business-sync.ts` persiste snapshots via `Queryable` e exige organização explícita.
- `lib/woodesk/feature-flags.ts` mantém o vocabulário de flags e fail-closed por default.
- `lib/woodesk/provider-health.ts` agrega saúde dos provedores e bloqueia execução quando não há capacidade disponível.
- `job_queue` e os workers existentes são a fila; nenhuma fila paralela foi criada.
- O frontend não recebe tokens e não conhece bibliotecas externas.

## Estados de integração

1. **Contrato**: domínio e DTO existem, mas nenhum provider está ativo.
2. **Configurado**: provider passou por licença/termos/credenciais e foi registrado.
3. **Operacional**: worker, retries, observabilidade e E2E estão verificados.

Lead Finder e Local SEO estão no estado 1. Google Business possui adapter, persistência, sincronização durável e reaproveita a conexão OAuth do calendário; o provisionamento operacional das credenciais e a validação de escopo real continuam pendentes.

## Segurança

Todo dado Woodesk é tenant-aware. Tokens Google permanecem cifrados no mecanismo OAuth existente. Browser automation, scraping e sidecars de voz não entram no request principal e não são habilitados por default.
# Health de integrações

`GET /api/v1/woodesk/health` consulta o `WoodeskCapabilityRegistry` e retorna somente estado, capabilities e latência dos providers habilitados. Segredos e tokens nunca fazem parte da resposta.
`analytics` faz parte do registry de feature flags e permanece fechado por padrão;
o endpoint só lê consumo quando a organização possui essa flag habilitada.
