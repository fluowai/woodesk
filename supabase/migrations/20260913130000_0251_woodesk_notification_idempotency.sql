-- 0251: evita duplicação de notificações transacionais em retries.

alter table public.woodesk_notifications
  add column if not exists idempotency_key text;

create unique index if not exists idx_woodesk_notifications_idempotency
  on public.woodesk_notifications (organization_id, idempotency_key)
  where idempotency_key is not null;
