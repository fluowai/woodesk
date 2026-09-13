# Módulos Woodesk

| Módulo | Estado atual | Reuso do core |
|---|---|---|
| CRM e pipeline | existente | `crm_leads`, funis, contatos, tarefas e propostas |
| WhatsApp | existente | WAHA, canais, inbox, anti-ban e opt-out |
| Agentes de IA | existente | Agent Engine, RAG, MCP e `job_queue` |
| Lead Finder | parcial operacional | resultados convertem para `crm_leads` somente por ação explícita; enrichment e diagnóstico são assíncronos |
| Local SEO/GeoGrid | parcial operacional | snapshots, jobs, agregação de métricas e tela operacional; provider avançado/mapa pendentes |
| Google Business | parcial operacional | OAuth, adapter oficial, snapshots e sync durável por localização |
| Instagram | parcial | conteúdo, aprovação, calendário, OAuth seguro, seleção explícita de conta por rascunho, adapter Meta Graph para post/carrossel/story/reel e job de publicação, inbox/DM/comentários canônicos e resposta enfileirada; caption/script publicáveis continuam pendentes |
| Voice AI | parcial | sidecar `VoiceProvider`, guardrails, fila, worker e adapter HTTP Pipecat/Voicebox |
| Marketing/campanhas | parcial | revisão, aprovação, agendamento e job com falha explícita sem adapter de entrega |
| Planos/limites | parcial | `plans`, `organizations.plan_id`, `plan_entitlements` e catálogo tipado de capabilities |

## Regra para novas telas

Uma tela só entra no menu após existir rota autenticada, contrato de dados, estado de carregamento/erro, feature flag quando aplicável e teste de navegação. A navegação canônica é `lib/navigation/catalogo.ts`.
