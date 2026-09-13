-- 0234: Local SEO e GeoGrid, tenant-aware e orientado a snapshots.

create table if not exists public.local_keywords (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  keyword text not null,
  locale text not null default 'pt-BR',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, keyword, locale)
);

create table if not exists public.local_grid_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  keyword_id uuid not null references public.local_keywords(id) on delete cascade,
  grid_size smallint not null check (grid_size in (3,5,7,9,11)),
  center_latitude numeric(9,6) not null check (center_latitude between -90 and 90),
  center_longitude numeric(9,6) not null check (center_longitude between -180 and 180),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  provider_id text not null,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.local_grid_points (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.local_grid_runs(id) on delete cascade,
  row_index smallint not null,
  column_index smallint not null,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  position integer check (position is null or position > 0),
  top_result_name text,
  top_result_url text,
  created_at timestamptz not null default now(),
  unique (run_id, row_index, column_index)
);

create table if not exists public.local_competitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  keyword_id uuid not null references public.local_keywords(id) on delete cascade,
  business_name text not null,
  position integer check (position is null or position > 0),
  rating numeric(2,1) check (rating is null or (rating between 0 and 5)),
  review_count integer check (review_count is null or review_count >= 0),
  distance_meters integer check (distance_meters is null or distance_meters >= 0),
  website text,
  phone text,
  source_url text,
  observed_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['local_keywords','local_grid_runs','local_grid_points','local_competitors'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%I_all on public.%I', t, t);
    execute format('create policy tenant_isolation_%I_all on public.%I for all using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()))', t, t);
  end loop;
end $$;

create index if not exists idx_local_keywords_active on public.local_keywords (organization_id, active);
create index if not exists idx_local_grid_runs_due on public.local_grid_runs (organization_id, status, created_at);
create index if not exists idx_local_grid_points_run on public.local_grid_points (organization_id, run_id);
create index if not exists idx_local_competitors_keyword on public.local_competitors (organization_id, keyword_id, observed_at);

alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check
  check (kind in ('inbound_turn','followup_turn','watchdog','flywheel','case_reply_turn','operator_turn','transactional_delivery','approved_reply','lead_finder_search','local_seo_grid'));
