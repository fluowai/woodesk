-- 0233: fundacao do Lead Finder Woodesk.
-- Resultados externos nao criam um segundo CRM; so viram leads por acao explicita.

create table if not exists public.feature_flags (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, key),
  constraint feature_flags_key_format check (key ~ '^[a-z][a-z0-9_.-]{1,99}$')
);

create table if not exists public.lead_finder_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  provider_id text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  query jsonb not null default '{}'::jsonb,
  result_count integer not null default 0 check (result_count >= 0),
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_finder_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  search_id uuid not null references public.lead_finder_searches(id) on delete cascade,
  external_id text,
  source_url text,
  name text not null,
  category text,
  phone text,
  website text,
  instagram text,
  address text,
  city text,
  state text,
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  review_count integer check (review_count is null or review_count >= 0),
  latitude numeric(9,6),
  longitude numeric(9,6),
  normalized_phone text,
  has_whatsapp boolean,
  status text not null default 'new' check (status in ('new','imported','rejected','duplicate')),
  imported_lead_id uuid references public.crm_leads(id) on delete set null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, search_id, external_id)
);

create table if not exists public.lead_enrichment (
  result_id uuid primary key references public.lead_finder_results(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  email text,
  facebook text,
  domain text,
  website_analysis jsonb not null default '{}'::jsonb,
  score integer check (score is null or (score >= 0 and score <= 100)),
  score_band text check (score_band is null or score_band in ('low','medium','high')),
  score_reasons jsonb not null default '[]'::jsonb,
  error_code text,
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['feature_flags','lead_finder_searches','lead_finder_results','lead_enrichment'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%I_all on public.%I', t, t);
    execute format('create policy tenant_isolation_%I_all on public.%I for all using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()))', t, t);
  end loop;
end $$;

create index if not exists idx_lead_finder_searches_due on public.lead_finder_searches (organization_id, status, created_at);
create index if not exists idx_lead_finder_results_org on public.lead_finder_results (organization_id, status, created_at);
create index if not exists idx_lead_enrichment_org_status on public.lead_enrichment (organization_id, status);

-- A busca nao tem contato: ela e trabalho de prospeccao, nao turno de atendimento.
alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check
  check (kind in ('inbound_turn','followup_turn','watchdog','flywheel','case_reply_turn','operator_turn','transactional_delivery','approved_reply','lead_finder_search'));
alter table public.job_queue drop constraint if exists job_queue_turn_needs_contact;
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid = 'job_queue'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%contact_id is not null%';
  if c is not null then execute format('alter table job_queue drop constraint %I', c); end if;
end $$;
alter table public.job_queue add constraint job_queue_turn_needs_contact
  check ((kind in ('inbound_turn','followup_turn','case_reply_turn','operator_turn')) = (contact_id is not null));
