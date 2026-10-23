create table if not exists public.admin_new_order_email_log (
  checkout_id bigint not null references public.checkouts(checkout_id) on delete cascade,
  recipient_email text not null,
  sent_at timestamptz not null default now(),
  primary key (checkout_id, recipient_email)
);

alter table public.admin_new_order_email_log enable row level security;
revoke all on public.admin_new_order_email_log from public, anon, authenticated;
grant select, insert, update, delete on public.admin_new_order_email_log to service_role;
