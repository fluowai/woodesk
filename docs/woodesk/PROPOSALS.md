# Propostas comerciais

## Auditoria

O core já possui propostas de IA, reativação e `contact_field_proposals`. Elas não representam uma proposta comercial com itens, preços, descontos, validade e aceite do cliente.

A capacidade comercial é protegida pela feature flag `sales_proposals` em todas as rotas.

## Decisão

Não reutilizar essas tabelas para simular um builder comercial: seus estados e invariantes têm semântica diferente. A capacidade comercial deve ser adicionada como domínio próprio, referenciando o `crm_lead` e o `contact` existentes, com RLS, auditoria, aprovação e idempotência.

## Estado

- CONFIRMADO: a migration 0243 criou `commercial_proposals` e `commercial_proposal_items` como tabelas tenant-aware, sem substituir leads, contatos ou pipeline canônicos.
- CONFIRMADO: migration `0243_woodesk_commercial_proposals` cria propostas e itens com RLS, valores em centavos e consistência de totais.
- CONFIRMADO: `GET/POST /api/v1/woodesk/proposals` lista e cria rascunhos, com cálculo de totais centralizado e testado.
- CONFIRMADO: `GET /api/v1/woodesk/proposals/:id` retorna proposta, vínculos e itens do tenant.
- CONFIRMADO: `POST /api/v1/woodesk/proposals/:id/send` exige `manager` e move apenas `draft` para `sent`.
- CONFIRMADO: `POST /api/v1/woodesk/proposals/:id/reject` permite rejeição auditável de propostas `draft` ou `sent`.
- CONFIRMADO: `POST /api/v1/woodesk/proposals/:id/accept` registra aceite de proposta `sent` por manager.
- CONFIRMADO: migration `0244_woodesk_proposal_signing` adiciona token público com hash, expiração e dados mínimos de assinatura; o envio retorna o token somente uma vez.
- CONFIRMADO: `GET/POST /api/v1/public/proposals/:token` consulta e aceita a proposta sem sessão, com aceite atômico e expiração; `/public/proposals/:token` oferece a tela de leitura e assinatura.
- CONFIRMADO: o aceite autenticado aceita opcionalmente `pipeline_id` + `won_stage_id` e move o lead vinculado para a etapa vencedora.
- PENDENTE: envio efetivo de notificações ao cliente por provider configurado.
