-- 0248: identifica o negócio-alvo de cada palavra-chave de Local SEO.
-- Sem um alvo, um resultado de Places é apenas presença de concorrente e não posição do cliente.

alter table public.local_keywords
  add column if not exists target_business_name text;

alter table public.local_keywords
  drop constraint if exists local_keywords_target_business_name_check;

alter table public.local_keywords
  add constraint local_keywords_target_business_name_check
  check (target_business_name is null or length(btrim(target_business_name)) between 2 and 200);

create index if not exists idx_local_keywords_target
  on public.local_keywords (organization_id, target_business_name)
  where target_business_name is not null;
