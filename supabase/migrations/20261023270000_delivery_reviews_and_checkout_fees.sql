alter table public.checkouts
  add column if not exists service_fee numeric(12,2) not null default 0,
  add column if not exists payment_reminder_sent_at timestamptz;

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
      and c.delivery_status = 'delivered'
      and coalesce(purchased.item->>'product_id', purchased.item->>'id') ~ '^[0-9]+$'
      and coalesce(purchased.item->>'product_id', purchased.item->>'id')::bigint = new.product_id
  ) then
    raise exception 'A delivered, paid purchase of this product is required to review';
  end if;

  return new;
end;
$$;
