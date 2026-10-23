-- Let a customer change or remove their review for three minutes after posting.
create or replace function public.enforce_product_review_change_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if auth.uid() is null or old.user_id is distinct from auth.uid() then
    raise exception 'You can only change your own review';
  end if;

  if clock_timestamp() >= old.created_at + interval '3 minutes' then
    raise exception 'Reviews can only be updated or deleted within three minutes after posting';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.product_id is distinct from old.product_id
       or new.order_item_id is distinct from old.order_item_id
       or new.created_at is distinct from old.created_at
       or new.status is distinct from old.status then
      raise exception 'Only the review message and rating can be changed';
    end if;
    new.updated_at := clock_timestamp();
    return new;
  end if;

  return old;
end;
$$;

revoke all on function public.enforce_product_review_change_window() from public, anon, authenticated;

drop trigger if exists enforce_product_review_change_window_trigger on public.product_reviews;
create trigger enforce_product_review_change_window_trigger
before update or delete on public.product_reviews
for each row execute function public.enforce_product_review_change_window();

drop policy if exists "users update own pending reviews" on public.product_reviews;
create policy "users update own pending reviews" on public.product_reviews
for update to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()))
with check (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "users delete own reviews" on public.product_reviews;
create policy "users delete own reviews" on public.product_reviews
for delete to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));
