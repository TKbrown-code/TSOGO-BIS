-- The status mailer also uses the language captured at checkout. This is
-- repeated idempotently so this migration remains safe if applied first.
alter table public.checkouts
  add column if not exists email_language text;

create table if not exists public.checkout_status_email_log (
  checkout_id bigint not null references public.checkouts(checkout_id) on delete cascade,
  status_type text not null check (status_type in ('order', 'delivery')),
  status text not null,
  sent_at timestamptz not null default now(),
  primary key (checkout_id, status_type, status)
);

alter table public.checkout_status_email_log enable row level security;
revoke all on public.checkout_status_email_log from public, anon, authenticated;
grant select, insert, update, delete on public.checkout_status_email_log to service_role;
