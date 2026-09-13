-- 0252: leitura por usuário para notificações compartilhadas da organização.

create table if not exists public.woodesk_notification_reads (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  notification_id uuid not null references public.woodesk_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.woodesk_notification_reads enable row level security;
drop policy if exists tenant_isolation_woodesk_notification_reads_all on public.woodesk_notification_reads;
create policy tenant_isolation_woodesk_notification_reads_all on public.woodesk_notification_reads for all
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));
revoke all on public.woodesk_notification_reads from anon;
