# Omnichannel

`GET /api/v1/woodesk/omnichannel/contacts/:id/timeline` compõe uma timeline única a partir das tabelas canônicas `messages`, `crm_lead_activities`, `commercial_proposals`, `voice_calls`, `calendar_appointments` e `crm_tasks`.

Não há novo cadastro de contato ou conversa. Cada evento mantém sua origem, canal, payload e timestamp; a consulta é limitada ao tenant autenticado e ordenada por ocorrência.

## Estado e regras

- WhatsApp reutiliza o core/WAHA; Instagram já possui ingestão Graph, resposta enfileirada e publicação server-side. E-mail e voz continuam dependentes de providers operacionais.
- A timeline inclui mensagens, atividades, propostas, chamadas, agenda e tarefas quando existirem registros canônicos.
- Todo envio deve ser assíncrono, idempotente e passar pelos guardrails de consentimento, opt-out, rate limit, janela permitida, cooldown e auditoria.
- Credenciais de Meta, provedores de e-mail e voz ficam somente no backend.
