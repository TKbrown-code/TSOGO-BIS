-- Reviews remain available to browse publicly, while writing is limited to
-- signed-in customers whose paid order containing the product is delivered.
grant select on public.product_reviews to anon, authenticated;

drop policy if exists "public read published reviews" on public.product_reviews;
create policy "public read published reviews" on public.product_reviews
for select to anon, authenticated
using (
  status = 'published'
  or user_id = (select auth.uid())
  or (select public.is_admin())
);

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
  ) then
    raise exception 'A paid, delivered purchase of this product is required to review';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_product_review_window() from public, anon, authenticated;

comment on function public.enforce_product_review_window() is
  'Requires a signed-in customer to have paid for and received the reviewed product. No posting deadline applies.';
