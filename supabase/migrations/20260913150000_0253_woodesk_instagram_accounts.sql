-- 0253 — contas Instagram por organização, com token cifrado em repouso.
create table if not exists public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  instagram_business_account_id text not null,
  page_id text,
  username text,
  access_token_encrypted bytea not null,
  token_expires_at timestamptz,
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, instagram_business_account_id)
);
create index if not exists instagram_accounts_org_idx on public.instagram_accounts (organization_id, updated_at desc);
alter table public.instagram_accounts enable row level security;
drop policy if exists tenant_isolation_instagram_accounts_select on public.instagram_accounts;
create policy tenant_isolation_instagram_accounts_select on public.instagram_accounts for select to authenticated using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_instagram_accounts_write on public.instagram_accounts;
create policy tenant_isolation_instagram_accounts_write on public.instagram_accounts for all to authenticated using (public.fn_role_at_least(organization_id, 'admin')) with check (public.fn_role_at_least(organization_id, 'admin'));
revoke all on public.instagram_accounts from anon;
revoke select (access_token_encrypted) on public.instagram_accounts from authenticated;
