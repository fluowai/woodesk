-- Woodesk Growth OS — limites de capacidades sobre o catálogo de planos existente.

create table if not exists public.plan_entitlements (
  plan_id uuid not null references public.plans(id) on delete cascade,
  capability text not null,
  enabled boolean not null default true,
  monthly_limit integer,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, capability),
  constraint plan_entitlements_capability_not_blank check (length(btrim(capability)) > 0),
  constraint plan_entitlements_limit_valid check (monthly_limit is null or monthly_limit >= 0)
);

alter table public.plan_entitlements enable row level security;
drop policy if exists users_read_plan_entitlements on public.plan_entitlements;
create policy users_read_plan_entitlements on public.plan_entitlements
  for select using (true);
drop policy if exists platform_admin_write_plan_entitlements on public.plan_entitlements;
create policy platform_admin_write_plan_entitlements on public.plan_entitlements
  for all using (public.fn_is_platform_admin())
  with check (public.fn_is_platform_admin());

create index if not exists idx_plan_entitlements_capability
  on public.plan_entitlements (capability, enabled);
revoke all on public.plan_entitlements from anon;
