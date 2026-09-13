-- 0236: chamadas de voz Woodesk, separadas de mensagens de áudio do WhatsApp.

create table if not exists public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  provider_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  status text not null default 'queued' check (status in ('queued','connecting','in_progress','completed','failed','cancelled')),
  external_id text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_id, external_id)
);

create table if not exists public.voice_transcripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_id uuid not null references public.voice_calls(id) on delete cascade,
  transcript text not null,
  language text,
  provider_id text not null,
  created_at timestamptz not null default now(),
  unique (call_id, provider_id)
);

do $$ declare t text; begin
  foreach t in array array['voice_calls','voice_transcripts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%I_all on public.%I', t, t);
    execute format('create policy tenant_isolation_%I_all on public.%I for all using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()))', t, t);
  end loop;
end $$;

create index if not exists idx_voice_calls_org_status on public.voice_calls (organization_id, status, created_at);
create index if not exists idx_voice_calls_contact on public.voice_calls (organization_id, contact_id, created_at desc);
create index if not exists idx_voice_transcripts_call on public.voice_transcripts (organization_id, call_id);

alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check
  check (kind in ('inbound_turn','followup_turn','watchdog','flywheel','case_reply_turn','operator_turn','transactional_delivery','approved_reply','lead_finder_search','local_seo_grid','voice_call'));
