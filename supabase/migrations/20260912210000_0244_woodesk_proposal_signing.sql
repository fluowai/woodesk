-- 0244: compartilhamento seguro e aceite eletrônico de propostas comerciais.
alter table public.commercial_proposals
  add column if not exists public_token_hash text,
  add column if not exists public_token_expires_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_name text;

create unique index if not exists idx_commercial_proposals_public_token
  on public.commercial_proposals (public_token_hash)
  where public_token_hash is not null;
