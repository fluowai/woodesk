-- Woodesk Growth OS — campanhas de marketing.
-- A campanha coordena conteúdo e execução; o envio continua delegado aos jobs/canais existentes.

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  objective text not null,
  channel text not null check (channel in ('whatsapp','instagram','email','sms','voice')),
  status text not null default 'draft' check (status in ('draft','review','approved','scheduled','running','paused','completed','failed','archived')),
  audience_filter jsonb not null default '{}'::jsonb check (jsonb_typeof(audience_filter) = 'object'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaigns_name_not_blank check (length(btrim(name)) > 0),
  constraint marketing_campaigns_objective_not_blank check (length(btrim(objective)) > 0),
  constraint marketing_campaigns_approval_consistent check (
    (status not in ('approved','scheduled','running','completed') or (approved_by is not null and approved_at is not null))
  ),
  constraint marketing_campaigns_period_valid check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

alter table public.marketing_campaigns enable row level security;
drop policy if exists tenant_isolation_marketing_campaigns_all on public.marketing_campaigns;
create policy tenant_isolation_marketing_campaigns_all on public.marketing_campaigns
  for all using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create index if not exists idx_marketing_campaigns_org_status
  on public.marketing_campaigns (organization_id, status, updated_at desc);
create index if not exists idx_marketing_campaigns_schedule
  on public.marketing_campaigns (organization_id, starts_at, ends_at)
  where status in ('approved','scheduled','running');

revoke all on public.marketing_campaigns from anon;
