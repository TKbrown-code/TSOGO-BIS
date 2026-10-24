-- Persistent, per-account in-app notices for new orders and order status changes.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('order_placed', 'order_update')),
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_user_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- The trigger is in a non-exposed schema; clients cannot invoke it directly.
-- The auth.uid guard allows service-role webhook updates but rejects signed-in
-- users changing somebody else's order from generating notifications.
create or replace function private.create_dashboard_order_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin record;
  v_actor uuid := auth.uid();
  v_payment_changed boolean := false;
  v_delivery_changed boolean := false;
  v_payload jsonb;
begin
  if tg_op = 'INSERT' then
    for v_admin in
      select ur.user_id from public.user_roles ur where ur.role = 'admin'
    loop
      insert into public.notifications (user_id, type, entity_id, payload)
      values (
        v_admin.user_id,
        'order_placed',
        new.checkout_id::text,
        jsonb_build_object(
          'checkout_id', new.checkout_id,
          'customer_name', new.user_name,
          'total', new.total,
          'payment_status', new.payment_status,
          'delivery_status', new.delivery_status
        )
      );
    end loop;
    return new;
  end if;

  v_payment_changed := old.payment_status is distinct from new.payment_status;
  v_delivery_changed := old.delivery_status is distinct from new.delivery_status;
  if not (v_payment_changed or v_delivery_changed) or new.user_id is null then
    return new;
  end if;

  if v_actor is not null and v_actor <> new.user_id and not exists (
    select 1 from public.user_roles ur where ur.user_id = v_actor and ur.role = 'admin'
  ) then
    return new;
  end if;

  v_payload := jsonb_build_object(
    'checkout_id', new.checkout_id,
    'payment_status', new.payment_status,
    'delivery_status', new.delivery_status,
    'payment_changed', v_payment_changed,
    'delivery_changed', v_delivery_changed
  );
  insert into public.notifications (user_id, type, entity_id, payload)
  values (new.user_id, 'order_update', new.checkout_id::text, v_payload);
  return new;
end;
$$;

revoke all on function private.create_dashboard_order_notifications() from public, anon, authenticated;
drop trigger if exists notify_admins_of_new_checkout on public.checkouts;
create trigger notify_admins_of_new_checkout
  after insert on public.checkouts
  for each row execute function private.create_dashboard_order_notifications();
drop trigger if exists notify_customer_of_checkout_status on public.checkouts;
create trigger notify_customer_of_checkout_status
  after update of payment_status, delivery_status on public.checkouts
  for each row
  when (old.payment_status is distinct from new.payment_status or old.delivery_status is distinct from new.delivery_status)
  execute function private.create_dashboard_order_notifications();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
