-- Use the linked order item as the review's purchase proof and open a
-- one-minute review window when an order is marked delivered.
alter table public.checkouts
  add column if not exists delivered_at timestamptz;

update public.checkouts c
set delivered_at = coalesce(o.updated_at, c.created_at)
from public.orders o
where c.order_id = o.id
  and c.delivery_status = 'delivered'
  and c.delivered_at is null;

create or replace function public.capture_checkout_delivery_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.delivery_status = 'delivered'
     and (tg_op = 'INSERT' or old.delivery_status is distinct from 'delivered') then
    new.delivered_at := coalesce(new.delivered_at, clock_timestamp());
  elsif new.delivery_status is distinct from 'delivered' then
    new.delivered_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_checkout_delivery_time_trigger on public.checkouts;
create trigger capture_checkout_delivery_time_trigger
before insert or update of delivery_status on public.checkouts
for each row execute function public.capture_checkout_delivery_time();

create or replace function public.enforce_product_review_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'You can only review as the signed-in customer';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || new.product_id::text, 0));

  if exists (
    select 1 from public.product_reviews r
    where r.user_id = new.user_id and r.product_id = new.product_id
  ) then
    raise exception 'Only one review is allowed for each product';
  end if;

  if new.order_item_id is null or not exists (
    select 1
    from public.order_items oi
    join public.checkouts c on c.order_id = oi.order_id
    where oi.id = new.order_item_id
      and oi.product_id = new.product_id
      and c.user_id = new.user_id
      and c.payment_status = 'paid'
      and c.delivery_status = 'delivered'
      and c.delivered_at is not null
      and clock_timestamp() >= c.delivered_at
      and clock_timestamp() < c.delivered_at + interval '1 minute'
  ) then
    raise exception 'A paid, delivered purchase is required and the one-minute review window must still be open';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_product_review_window() from public, anon, authenticated;

drop policy if exists "verified buyers create reviews" on public.product_reviews;
create policy "verified buyers create reviews" on public.product_reviews
for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');

comment on column public.checkouts.delivered_at is
  'Timestamp used to enforce the one-minute verified product review window.';
