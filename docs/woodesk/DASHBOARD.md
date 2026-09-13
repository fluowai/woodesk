# Dashboard Growth OS

`lib/woodesk/dashboard.ts` define o contrato de métricas da home Woodesk:

- leads encontrados;
- reuniões agendadas;
- oportunidades;
- vendas em centavos (`salesCents`);
- conteúdos gerados;
- ligações de voz.

Cada métrica carrega o valor atual, o período anterior e a variação percentual. Quando não existe base anterior, a variação é `null`, evitando exibir um crescimento inventado. A consulta autenticada da tela já compõe os valores de tabelas canônicas e Woodesk, sempre filtrando `organization_id`.
# Dashboard Growth OS

`GET /api/v1/woodesk/dashboard` retorna métricas comparativas da janela solicitada e os dez eventos mais recentes de `crm_lead_activities`, sempre filtrados pelo tenant autenticado.

Também retorna `alerts.failed_jobs` e os dez jobs `failed`/`dead` mais recentes para sinalizar falhas operacionais sem mascará-las.
O endpoint do dashboard aceita uma janela customizada, limitada a 366 dias para
impedir que a série diária provoque consultas desproporcionais. A UI padrão usa
30 dias; intervalos maiores devem ser solicitados por partes.
