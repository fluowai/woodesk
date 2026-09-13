-- 0249: metas operacionais do Growth OS, sempre delimitadas por organização e período.

create table if not exists public.woodesk_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null check (metric in ('leads_found','appointments','opportunities','sales_cents','contents_generated','voice_calls')),
  target numeric(14,2) not null check (target > 0),
  period_start date not null,
  period_end date not null,
  label text not null check (length(btrim(label)) between 1 and 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

alter table public.woodesk_goals enable row level security;
drop policy if exists tenant_isolation_woodesk_goals_all on public.woodesk_goals;
create policy tenant_isolation_woodesk_goals_all on public.woodesk_goals for all
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));
create index if not exists idx_woodesk_goals_period on public.woodesk_goals (organization_id, period_start, period_end);
revoke all on public.woodesk_goals from anon;
