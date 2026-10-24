-- Anonymous users can read only currently available coupons. Keep the admin
-- predicate in an authenticated-only policy because anon cannot execute is_admin().
drop policy if exists "public read active coupons" on public.coupons;
drop policy if exists "authenticated read active coupons or admin" on public.coupons;

create policy "public read active coupons" on public.coupons
for select to anon
using (
  active
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at > now())
);

create policy "authenticated read active coupons or admin" on public.coupons
for select to authenticated
using (
  (
    active
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at > now())
  )
  or (select public.is_admin())
);
