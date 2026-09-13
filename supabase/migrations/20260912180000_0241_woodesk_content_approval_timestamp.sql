-- 0241: completa a trilha de aprovação editorial.
alter table public.marketing_contents add column if not exists approved_at timestamptz;
create index if not exists idx_marketing_contents_approval
  on public.marketing_contents (organization_id, status, approved_at desc);
