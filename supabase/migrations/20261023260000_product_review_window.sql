-- Start the customer's one-minute review window when payment succeeds and
-- reject duplicate or late product reviews in the database as well as the UI.
alter table public.checkouts
  add column if not exists paid_at timestamptz;

update public.checkouts
set paid_at = created_at
where payment_status = 'paid' and paid_at is null;

create or replace function public.set_checkout_paid_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    new.paid_at := coalesce(new.paid_at, clock_timestamp());
  end if;
  return new;
end;
$$;

drop trigger if exists set_checkout_paid_at_trigger on public.checkouts;
create trigger set_checkout_paid_at_trigger
before update of payment_status on public.checkouts
for each row execute function public.set_checkout_paid_at();

create or replace function public.enforce_product_review_window()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'You can only review as the signed-in customer';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || new.product_id::text, 0));

  if exists (
    select 1 from public.product_reviews r
    where r.user_id = new.user_id and r.product_id = new.product_id
  ) then
    raise exception 'Only one review is allowed for each product';
  end if;

  if not exists (
    select 1
    from public.checkouts c
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(c.items) = 'array' then c.items else '[]'::jsonb end
    ) as purchased(item)
    where c.user_id = new.user_id
      and c.payment_status = 'paid'
      and c.paid_at is not null
      and clock_timestamp() >= c.paid_at
      and clock_timestamp() < c.paid_at + interval '1 minute'
      and coalesce(purchased.item->>'product_id', purchased.item->>'id') ~ '^[0-9]+$'
      and coalesce(purchased.item->>'product_id', purchased.item->>'id')::bigint = new.product_id
  ) then
    raise exception 'The one-minute review window has ended or no paid purchase was found';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_product_review_window_trigger on public.product_reviews;
create trigger enforce_product_review_window_trigger
before insert on public.product_reviews
for each row execute function public.enforce_product_review_window();
