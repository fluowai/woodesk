-- 0250: notificações transacionais persistidas do Growth OS.

create table if not exists public.woodesk_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('proposal_sent','proposal_accepted','proposal_rejected','goal_reached','job_failed','system')),
  title text not null check (length(btrim(title)) between 1 and 200),
  body text not null check (length(btrim(body)) between 1 and 2000),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.woodesk_notifications enable row level security;
drop policy if exists tenant_isolation_woodesk_notifications_all on public.woodesk_notifications;
create policy tenant_isolation_woodesk_notifications_all on public.woodesk_notifications for all
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));
create index if not exists idx_woodesk_notifications_user on public.woodesk_notifications (organization_id, user_id, read_at, created_at desc);
revoke all on public.woodesk_notifications from anon;
