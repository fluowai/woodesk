-- 0243: propostas comerciais Woodesk, separadas das propostas de IA.

create table if not exists public.commercial_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired','cancelled')),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  valid_until date,
  title text not null,
  terms text,
  created_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_proposals_total_consistent check (total_cents = subtotal_cents - discount_cents and total_cents >= 0)
);

create table if not exists public.commercial_proposal_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.commercial_proposals(id) on delete cascade,
  description text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now(),
  constraint commercial_proposal_items_total_consistent check (total_cents = round(quantity * unit_price_cents))
);

alter table public.commercial_proposals enable row level security;
alter table public.commercial_proposal_items enable row level security;
drop policy if exists tenant_isolation_commercial_proposals_all on public.commercial_proposals;
drop policy if exists tenant_isolation_commercial_proposal_items_all on public.commercial_proposal_items;
create policy tenant_isolation_commercial_proposals_all on public.commercial_proposals for all using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
create policy tenant_isolation_commercial_proposal_items_all on public.commercial_proposal_items for all using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
create index if not exists idx_commercial_proposals_org_status on public.commercial_proposals (organization_id, status, updated_at desc);
create index if not exists idx_commercial_proposals_contact on public.commercial_proposals (organization_id, contact_id, created_at desc);
create index if not exists idx_commercial_proposal_items_proposal on public.commercial_proposal_items (organization_id, proposal_id);
revoke all on public.commercial_proposals, public.commercial_proposal_items from anon;
