# Marketing e campanhas

## Estado

`marketing_contents` e `content_calendar_items` armazenam conteúdo e agenda. A migration `0238` adiciona `marketing_campaigns` como coordenador multi-tenant de objetivo, público, canal, janela e estado.

Campanhas nascem como `draft` e exigem revisão/aprovação antes de `scheduled`, `running` ou `completed`. A aplicação não envia mensagens dentro de uma requisição de criação; a execução deve ser feita por job assíncrono e pelos providers de canal existentes.

## Canais

Os canais suportados no contrato são WhatsApp, Instagram, e-mail, SMS e voz. O conteúdo pode ser reutilizado pela campanha, mas a publicação/envio precisa preservar consentimento, opt-out, horário permitido, limite diário e auditoria do core.

## Estado real dos providers

A tela de gestão e o worker assíncrono de execução já existem. O worker exige uma campanha tenant-scoped, recebe um provider por composição e encerra explicitamente como `campaign_provider_not_configured` quando não há adapter habilitado; não há envio parcial nem promessa de entrega implícita.

## Operação do provider

O worker principal injeta `createHttpCampaignDeliveryProvider` quando
`CAMPAIGN_PROVIDER_ID`, `CAMPAIGN_PROVIDER_BASE_URL` e `CAMPAIGN_PROVIDER_TOKEN`
estão configurados. O gateway deve expor `POST /campaigns/deliver` e
`GET /health`; o token é enviado apenas como Bearer no servidor. Sem as três
variáveis, a execução falha de forma explícita e auditável.

Ainda dependem de implementação/provisionamento por canal: adapters oficiais de WhatsApp, Instagram, e-mail, SMS e voz; materialização de audiência com consentimento e opt-out; limites de frequência/horário e evidência operacional de entrega. Essas regras devem ser aplicadas antes do provider disparar mensagens.
# Marketing e campanhas

As campanhas usam `marketing_campaigns` e a máquina de estados do domínio `lib/woodesk/campaigns.ts`.

- `GET/POST /api/v1/woodesk/marketing/campaigns`: listar e criar rascunhos tenant-aware.
- `POST /api/v1/woodesk/marketing/campaigns/:id/submit`: envia um rascunho para revisão.
- `POST /api/v1/woodesk/marketing/campaigns/:id/approve`: aprovação exclusiva de manager.
- `POST /api/v1/woodesk/marketing/campaigns/:id/schedule`: agenda somente campanhas aprovadas.

Campanhas não enviam mensagens diretamente na requisição. A execução por canal deve ser delegada aos jobs e providers existentes, com aprovação humana antes de qualquer disparo.
