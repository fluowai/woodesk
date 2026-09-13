-- 0237: conteúdo editorial e calendário Woodesk.
-- Não duplica a tabela de campanhas Meta Ads: esta guarda ativos editoriais.

create table if not exists public.marketing_contents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('instagram','whatsapp','email','sms','voice')),
  content_type text not null check (content_type in ('post','story','reel','carousel','caption','script','email')),
  status text not null default 'draft' check (status in ('draft','review','approved','scheduled','published','failed','archived')),
  title text,
  body text not null,
  media jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  generated_by_agent_id uuid references public.ai_agents(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_calendar_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_id uuid not null references public.marketing_contents(id) on delete cascade,
  scheduled_for timestamptz not null,
  timezone text not null default 'America/Sao_Paulo',
  status text not null default 'scheduled' check (status in ('scheduled','processing','published','failed','cancelled')),
  provider_id text,
  external_id text,
  error_code text,
  created_at timestamptz not null default now(),
  unique (content_id, scheduled_for)
);

do $$ declare t text; begin
  foreach t in array array['marketing_contents','content_calendar_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%I_all on public.%I', t, t);
    execute format('create policy tenant_isolation_%I_all on public.%I for all using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()))', t, t);
  end loop;
end $$;

create index if not exists idx_marketing_contents_org_status on public.marketing_contents (organization_id, status, created_at desc);
create index if not exists idx_content_calendar_due on public.content_calendar_items (organization_id, status, scheduled_for);
