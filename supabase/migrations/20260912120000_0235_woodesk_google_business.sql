-- 0235: métricas oficiais do Google Business Profile.
-- Reutiliza calendar_connections para identidade/OAuth cifrado; não cria outro
-- cofre de tokens. O connection_id só referencia a conta Google já consentida.

create table if not exists public.google_business_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  resource_name text not null,
  title text not null,
  address jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','paused','error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, resource_name)
);

create table if not exists public.google_business_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.google_business_locations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  source text not null default 'google_business_profile_performance',
  fetched_at timestamptz not null default now(),
  unique (location_id, period_start, period_end, source),
  check (period_end >= period_start)
);

do $$ declare t text; begin
  foreach t in array array['google_business_locations','google_business_metrics'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%I_all on public.%I', t, t);
    execute format('create policy tenant_isolation_%I_all on public.%I for all using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()))', t, t);
  end loop;
end $$;

create index if not exists idx_google_business_locations_org_status on public.google_business_locations (organization_id, status);
create index if not exists idx_google_business_metrics_location_period on public.google_business_metrics (organization_id, location_id, period_start desc);
