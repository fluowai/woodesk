# Voice AI

## Estado

A migration `20260912130000_0236_woodesk_voice` separa chamadas telefônicas de mensagens de áudio existentes. `voice_calls` guarda o ciclo de vida e custo; `voice_transcripts` guarda a transcrição por provider.

`VoiceProvider` é um contrato de sidecar. O core não abre browser, não armazena credenciais de voz e não chama Pipecat/Voicebox diretamente. O worker inclui um adaptador HTTP injetável (`createHttpVoiceProvider`) para esses gateways; endpoint e bearer continuam responsabilidade do ambiente de execução.

## Segurança

Toda chamada carrega organização e, quando aplicável, contato. Tokens e credenciais ficam fora destas tabelas, em cofre cifrado. Ações de ligação outbound devem respeitar consentimento, opt-out, horário permitido e limites por tenant.
# Voz

`POST /api/v1/woodesk/voice/calls` cria uma chamada tenant-aware em estado `queued` e enfileira `voice_call`.

`GET /api/v1/woodesk/voice/calls/:id` retorna o estado da chamada e as transcrições persistidas do próprio tenant.

Chamadas outbound passam por consentimento, opt-out, horário permitido e contagem diária server-side. A API não executa áudio nem expõe credenciais; a execução concreta depende de um `VoiceProvider` configurado no worker. Sem provider, o worker registra `failed` com `voice_provider_not_configured`, em vez de deixar o job órfão.
## Operação do worker

O job `voice_call` usa o adapter HTTP server-side quando as três variáveis abaixo
estão presentes no ambiente do worker:

- `VOICE_PROVIDER=pipecat` ou `VOICE_PROVIDER=voicebox`
- `VOICE_PROVIDER_BASE_URL`
- `VOICE_PROVIDER_TOKEN`

O token só é enviado no header `Authorization: Bearer` e nunca é persistido ou
logado. Se a configuração estiver incompleta, o worker permanece inicializável e
marca a capability como indisponível; não há fallback fictício.
