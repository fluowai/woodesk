-- 0254 — vocabulário de sessão para Instagram Graph.
--
-- A conta OAuth continua em instagram_accounts; a sessão é apenas a ponte para
-- conversations/messages. Não reutilizar meta_phone_number_id: são namespaces
-- diferentes e Instagram não possui phone_number_id.

alter table public.channel_sessions
  add column if not exists instagram_account_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'channel_sessions_instagram_account_fk'
      and conrelid = 'public.channel_sessions'::regclass
  ) then
    alter table public.channel_sessions
      add constraint channel_sessions_instagram_account_fk
      foreign key (instagram_account_id)
      references public.instagram_accounts(id)
      on delete set null;
  end if;
end $$;

alter table public.channel_sessions
  drop constraint if exists channel_sessions_provider_check;
alter table public.channel_sessions
  add constraint channel_sessions_provider_check
  check (provider = any (array['waha'::text, 'meta_cloud'::text, 'zernio'::text, 'instagram_graph'::text]));

alter table public.channel_sessions
  drop constraint if exists channel_sessions_provider_ref_check;
alter table public.channel_sessions
  add constraint channel_sessions_provider_ref_check check (
    (provider = 'waha' and waha_session_name is not null) or
    (provider = 'meta_cloud' and meta_phone_number_id is not null) or
    (provider = 'zernio' and zernio_account_id is not null) or
    (provider = 'instagram_graph' and instagram_account_id is not null)
  );

create unique index if not exists channel_sessions_instagram_account_active_unique
  on public.channel_sessions (organization_id, instagram_account_id)
  where provider = 'instagram_graph' and archived_at is null and instagram_account_id is not null;

comment on column public.channel_sessions.instagram_account_id is
  'Conta Instagram Graph conectada; referência própria, sem reutilizar identificadores WhatsApp.';
