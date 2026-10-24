create table if not exists public.coupons (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code = upper(trim(code)) and length(code) between 3 and 40),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_amount numeric(12,2) not null default 0 check (minimum_amount >= 0),
  product_id bigint references public.products(id) on delete cascade,
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_max check (discount_type <> 'percent' or discount_value <= 100),
  constraint coupons_valid_period check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create index if not exists coupons_active_product_idx on public.coupons(active, product_id, code);
alter table public.coupons enable row level security;
grant select on public.coupons to anon, authenticated;
grant insert, update, delete on public.coupons to authenticated;
drop policy if exists "public read active coupons" on public.coupons;
create policy "public read active coupons" on public.coupons
for select to anon, authenticated
using (active and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at > now()) or (select public.is_admin()));
drop policy if exists "admins manage coupons" on public.coupons;
create policy "admins manage coupons" on public.coupons
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.site_settings
  add column if not exists ad_popup_enabled boolean not null default false,
  add column if not exists ad_popup_title_en text not null default '',
  add column if not exists ad_popup_title_fr text not null default '',
  add column if not exists ad_popup_body_en text not null default '',
  add column if not exists ad_popup_body_fr text not null default '',
  add column if not exists ad_popup_cta_en text not null default '',
  add column if not exists ad_popup_cta_fr text not null default '',
  add column if not exists ad_popup_image_url text not null default '',
  add column if not exists ad_popup_link_url text not null default '',
  add column if not exists ad_popup_starts_at timestamptz,
  add column if not exists ad_popup_ends_at timestamptz;

-- Add an account lock state to the admin's customer directory.
drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  phone text,
  preferred_language text,
  created_at timestamptz,
  is_admin boolean,
  order_count bigint,
  paid_total numeric,
  last_order_at timestamptz,
  banned_until timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
  select au.id, au.email::text,
    coalesce(nullif(p.display_name, ''), nullif(au.raw_user_meta_data ->> 'display_name', ''), nullif(au.raw_user_meta_data ->> 'full_name', ''), nullif(split_part(coalesce(au.email, ''), '@', 1), '')),
    coalesce(p.phone, au.phone)::text,
    coalesce(p.preferred_language, 'fr')::text,
    au.created_at,
    exists (select 1 from public.user_roles ur where ur.user_id = au.id and ur.role = 'admin'),
    coalesce(activity.order_count, 0)::bigint,
    coalesce(activity.paid_total, 0)::numeric,
    activity.last_order_at,
    au.banned_until
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  left join lateral (
    select count(*)::bigint as order_count,
      coalesce(sum(c.total) filter (where c.payment_status in ('paid', 'succeeded', 'successful')), 0)::numeric as paid_total,
      max(c.created_at) as last_order_at
    from public.checkouts c where c.user_id = au.id
  ) activity on true
  order by au.created_at desc;
end;
$$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Admin-only, transactional purge. Preserves referral credit ledger entries by
-- detaching checkout references before deleting the historical order rows.
create or replace function public.admin_delete_all_orders()
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  delete from public.shipment_events;
  delete from public.shipments;
  delete from public.payment_attempts;
  update public.referral_wallet_ledger set checkout_id = null where checkout_id is not null;
  delete from public.checkouts;
  get diagnostics deleted_count = row_count;
  delete from public.orders;
  return deleted_count;
end;
$$;
revoke all on function public.admin_delete_all_orders() from public, anon;
grant execute on function public.admin_delete_all_orders() to authenticated;
