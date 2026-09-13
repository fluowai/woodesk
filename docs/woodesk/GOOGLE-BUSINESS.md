# Google Business Profile

## Estado

A migration `20260912120000_0235_woodesk_google_business` adiciona localizações e snapshots de métricas, mas reutiliza `calendar_connections` como origem de identidade e tokens OAuth cifrados. Não existe um segundo cofre de credenciais.

As métricas são snapshots idempotentes por localização, período e fonte. O domínio valida recursos `locations/*`, períodos e valores não negativos antes da persistência.

`persistGoogleBusinessSnapshot` grava o snapshot com `upsert` e filtra a organização tanto na escrita quanto na atualização da localização. O worker pode reutilizar esse método com o pool Postgres existente, sem transportar tokens para a camada de persistência.

## Integração oficial

O adapter futuro deve usar a API oficial de Performance do Google, renovar tokens pelo fluxo já existente e registrar auditoria/erro sem expor tokens. Scraping de páginas públicas não é fallback automático.
# Google Business Profile

`GET /api/v1/woodesk/google-business/locations` lista as localizações conectadas do tenant.

`GET /api/v1/woodesk/google-business/metrics` lista snapshots persistidos da Business Profile Performance API, com filtros opcionais por `location_id`, `from` e `to`.

Os tokens OAuth continuam pertencendo à conexão Google existente e não são retornados pela API. A sincronização deve ser executada pelo worker/provider, nunca bloqueando uma requisição de UI.
