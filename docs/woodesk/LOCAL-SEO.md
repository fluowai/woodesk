# Woodesk Local SEO

## Estado

A fundação de snapshots e GeoGrid foi criada na migration `20260912110000_0234_woodesk_local_seo`.

`local_keywords` representa o catálogo de termos do tenant. Cada execução cria um `local_grid_runs` e seus pontos em `local_grid_points`; isso mantém histórico e permite comparar períodos sem sobrescrever o passado. Concorrentes observados são fatos temporais em `local_competitors`.

## Contrato de posição

As posições são números positivos retornados por um provider. O domínio não assume que `null` seja posição ruim: significa que o provider não encontrou o negócio naquele ponto. As métricas ignoram pontos sem posição e retornam `null` quando nenhum ponto tem sinal.

Cada palavra-chave também possui `target_business_name`. O worker exige esse alvo antes de executar a grade; resultados do Places sem correspondência de ranking continuam sendo evidência de presença, não posição do cliente.

Faixas visuais:

- 1–3: verde;
- 4–10: amarelo;
- 11–20: laranja;
- 21+: vermelho.

## Execução

Execuções devem ser jobs assíncronos, com provider explícito, status, retry e auditoria. Nenhum provider de scraping foi habilitado por esta migration; a camada de provider precisa validar fonte, licença, termos, limites e credenciais antes de produção.
# Local SEO e GeoGrid

## Superfície atual

`GET/POST /api/v1/woodesk/local-seo/keywords` lista e cadastra palavras-chave rastreadas.

`POST /api/v1/woodesk/local-seo/runs` cria ou reutiliza uma palavra-chave, materializa os pontos do grid e enfileira um snapshot `local_seo_grid`.

`GET /api/v1/woodesk/local-seo/runs/:id` retorna o estado, os pontos persistidos e as métricas agregadas do snapshot.

`GET /api/v1/woodesk/local-seo/runs` lista o histórico das execuções, com filtro opcional por status.

`GET /api/v1/woodesk/local-seo/keywords/:id/competitors` lista os concorrentes observados para uma palavra-chave.

O endpoint exige a feature flag `local_seo`, aplica o tenant da sessão e retorna `202` enquanto a coleta aguarda um provider. Posições, concorrentes e métricas só devem ser persistidos por um adaptador configurado; não há fallback com dados sintéticos.

## Estado

- CONFIRMADO: schema tenant-aware, RLS, grid determinístico e agregação de métricas.
- CONFIRMADO: criação de execução e fila via endpoint autenticado.
- PARCIAL: o worker coleta presença/resultados e a UI exibe o heatmap; a posição numérica permanece `null` até um provider de ranking local com contrato de posição real ser configurado.
