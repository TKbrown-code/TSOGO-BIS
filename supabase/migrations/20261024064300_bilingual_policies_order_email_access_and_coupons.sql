alter table public.site_settings
  add column if not exists terms_and_policies_en text not null default '',
  add column if not exists terms_and_policies_fr text not null default '',
  add column if not exists coupon_code text not null default '',
  add column if not exists coupon_discount_type text not null default 'percent',
  add column if not exists coupon_discount_value numeric(12,2) not null default 0,
  add column if not exists coupon_minimum numeric(12,2) not null default 0,
  add column if not exists coupon_active boolean not null default false;

alter table public.checkouts
  add column if not exists coupon_code text,
  add column if not exists coupon_discount numeric(12,2) not null default 0;

update public.site_settings
set terms_and_policies_en = terms_and_policies
where terms_and_policies_en = '' and coalesce(terms_and_policies, '') <> '';

-- The service-role-backed create-fapshi-order function needs to read this table
-- to find administrator recipients. RLS remains enabled; no client role gets
-- this grant.
grant select on table public.user_roles to service_role;
