-- 0247: medição central e idempotente de uso do Growth OS.

create table if not exists public.woodesk_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capability text not null,
  period_start date not null,
  quantity integer not null default 1 check (quantity > 0),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  unique (organization_id, capability, period_start, idempotency_key)
);

alter table public.woodesk_usage_events enable row level security;
drop policy if exists tenant_isolation_woodesk_usage_events_all on public.woodesk_usage_events;
create policy tenant_isolation_woodesk_usage_events_all on public.woodesk_usage_events
  for all using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

create index if not exists idx_woodesk_usage_events_period
  on public.woodesk_usage_events (organization_id, capability, period_start, occurred_at desc);

revoke all on public.woodesk_usage_events from anon;
