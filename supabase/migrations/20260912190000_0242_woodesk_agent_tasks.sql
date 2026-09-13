-- 0242: tarefas duráveis do orquestrador Woodesk.

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  role text not null,
  capability text not null,
  input jsonb not null default '{}'::jsonb check (jsonb_typeof(input) = 'object'),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  requires_human_approval boolean not null default true,
  error_code text,
  result jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.agent_tasks enable row level security;
drop policy if exists tenant_isolation_agent_tasks_all on public.agent_tasks;
create policy tenant_isolation_agent_tasks_all on public.agent_tasks
  for all using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

create index if not exists idx_agent_tasks_org_status on public.agent_tasks (organization_id, status, created_at desc);
create index if not exists idx_agent_tasks_org_capability on public.agent_tasks (organization_id, capability, created_at desc);
revoke all on public.agent_tasks from anon;

alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check
  check (kind in ('inbound_turn','followup_turn','watchdog','flywheel','case_reply_turn','operator_turn','transactional_delivery','approved_reply','lead_finder_search','local_seo_grid','voice_call','lead_enrichment','agent_task'));
