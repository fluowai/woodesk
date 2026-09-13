# Woodesk Lead Finder

## Estado

Fundação de dados e domínio implementada na migration `20260912100000_0233_woodesk_lead_finder`.

`GET /api/v1/lead-finder/results` lista resultados tenant-aware com filtros opcionais por `search_id` e `status`, incluindo o enrichment e score associado.

`GET /api/v1/lead-finder/searches` lista o histórico das buscas, com filtro opcional por status e contagem persistida de resultados.

`POST /api/v1/lead-finder/searches/:id/cancel` cancela buscas ainda `queued`; o worker verifica o estado antes de consultar o provider.

A busca aceita faixa de nota, faixa de avaliações, presença de site, WhatsApp e Instagram; esses filtros são reaplicados no worker antes da persistência.

`POST /api/v1/lead-finder/results/:id/reject` descarta explicitamente um resultado ainda não importado, sem apagá-lo do histórico.

## Contrato

O Lead Finder recebe uma importação explícita do extractor de navegador. `POST
/api/v1/lead-finder/imports` valida a feature flag, cria uma linha em
`lead_finder_searches` com provider `browser_import` e grava resultados
normalizados em `lead_finder_results`.

Um resultado externo não é automaticamente um lead do CRM. A conversão exige uma ação explícita e idempotente, que preencherá `imported_lead_id` e `status='imported'`.

## Enriquecimento

`lead_enrichment` guarda o estado do trabalho separado do resultado bruto. Isso permite retry seguro, evita bloquear uma busca e registra score/reasons sem alterar a entidade CRM.

O código de domínio em `lib/woodesk/lead-finder.ts`:

- normaliza telefone sem afirmar que ele possui WhatsApp;
- rejeita nome vazio;
- calcula score determinístico de 0 a 100 somente sobre sinais presentes;
- retorna faixa e motivos estruturados.

## Segurança e operação

- Toda tabela possui `organization_id` e policy de isolamento.
- Nenhuma credencial de provider é aceita no payload do resultado.
- Scraping/browser automation não está habilitado por esta migration.
- A fonte deve ser classificada e aprovada antes de um provider de produção ser registrado.
- Busca e enriquecimento devem usar `job_queue`/workers existentes, sem chamadas externas no request.

## Operação

1. Executar o extractor de navegador localmente e exportar CSV/JSON.
2. Mapear o arquivo para o payload `{"leads": [...]}` do endpoint de importação.
3. Revisar diagnóstico e score no Woodesk.
4. Converter explicitamente os resultados aprovados para o CRM.
## Diagnóstico comercial

`lib/woodesk/diagnostic.ts` transforma os sinais coletados em problemas, oportunidades, prioridades e pitch parametrizado. O resultado é uma recomendação para revisão do operador/agente; ele não dispara abordagem automaticamente nem inventa métricas ausentes.

## Provider oficial

O Lead Finder não chama a API do Google. Os extractors de navegador listados no prompt produzem CSV/JSON; o endpoint `POST /api/v1/lead-finder/imports` recebe JSON, CSV (`text/csv`) ou arquivo CSV em `multipart/form-data` (`file`), normaliza os campos e cria uma busca `browser_import` tenant-aware.

O processamento de navegador ocorre fora do request e a importação é explícita. Não há scraping server-side silencioso nem chave de API Google no Lead Finder.

O worker `lib/woodesk/lead-finder-worker.ts` lê a busca pelo `organization_id`, chama o provider configurado, persiste resultados e score em uma transação e marca a busca como `completed` ou `failed`. Falhas sobem para a fila para retry; não há dados de exemplo ou fallback fictício.

Resultados podem ser adicionados ao CRM por `POST /api/v1/lead-finder/results/:id/import`, informando `pipeline_id` e `stage_id`. A rota reutiliza `createLeadHandler`, exige papel `agent`, registra a origem `browser_import` e marca o resultado como `imported` de forma idempotente.

A importação usa `crm_leads.external_id` derivado do resultado, além da marcação no resultado externo, para resistir a duas requisições concorrentes sem criar dois leads.
# Lead Finder

`GET /api/v1/lead-finder/results` lista resultados tenant-aware com filtros opcionais por `search_id` e `status`, incluindo o enrichment e score associado.
