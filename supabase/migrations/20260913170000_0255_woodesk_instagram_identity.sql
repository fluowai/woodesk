-- 0255 — identidade externa Instagram separada da identidade WhatsApp.

alter table public.contacts
  add column if not exists instagram_identity text;

alter table public.contacts
  drop constraint if exists contacts_instagram_identity_check;
alter table public.contacts
  add constraint contacts_instagram_identity_check
  check (instagram_identity is null or instagram_identity ~ '^ig:[A-Za-z0-9_.:-]{1,240}$');

create unique index if not exists uniq_contacts_org_instagram_identity
  on public.contacts (organization_id, instagram_identity)
  where instagram_identity is not null and is_merged_into is null and is_anonymized = false;

comment on column public.contacts.instagram_identity is
  'Identidade externa do usuário Instagram no formato ig:<id>; não substitui wa_identity e não representa consentimento.';
