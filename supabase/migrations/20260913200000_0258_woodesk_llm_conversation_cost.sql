-- 0258 — preserva a conversa canônica na telemetria de IA.
alter table public.llm_calls add column if not exists conversation_id uuid references public.conversations(id) on delete set null;
create index if not exists llm_calls_conversation_idx on public.llm_calls (organization_id, conversation_id, created_at desc) where conversation_id is not null;
comment on column public.llm_calls.conversation_id is 'Conversa canônica associada à chamada de IA quando o produtor conhece o contexto; registros históricos podem ser nulos.';
