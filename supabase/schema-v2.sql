-- TSOGO-BIS schema v2 blueprint
-- Fresh database bootstrap only. Do not apply to the existing project as-is:
-- the current database has legacy tables with overlapping names and needs a
-- deliberate data migration and application cutover first.

begin;

create schema if not exists extensions;
create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  preferred_language text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.categories (
  id bigint generated always as identity primary key,
  parent_id bigint references public.categories(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create table public.products (
  id bigint generated always as identity primary key,
  category_id bigint references public.categories(id) on delete set null,
  slug text not null unique,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  currency char(3) not null default 'XAF',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  origin_country text,
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  shipping_methods jsonb not null default '[]'::jsonb check (jsonb_typeof(shipping_methods) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index product_images_one_primary_per_product
  on public.product_images(product_id) where is_primary;

create table public.product_tags (
  product_id bigint not null references public.products(id) on delete cascade,
  tag text not null,
  valid_from timestamptz,
  valid_until timestamptz,
  primary key (product_id, tag),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create table public.cart_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity between 1 and 99),
  variant_key text not null default '',
  selected_options jsonb not null default '{}'::jsonb check (jsonb_typeof(selected_options) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, variant_key)
);

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  currency char(3) not null default 'XAF',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping_total numeric(12,2) not null default 0 check (shipping_total >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  grand_total numeric(12,2) not null check (grand_total >= 0),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  product_name text not null,
  product_sku text,
  selected_options jsonb not null default '{}'::jsonb check (jsonb_typeof(selected_options) = 'object'),
  quantity integer not null check (quantity between 1 and 99),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.payment_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider in ('campay', 'fapshi')),
  provider_reference text,
  idempotency_key text not null unique,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
  provider_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create table public.shipments (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  carrier text,
  tracking_number text unique,
  tracking_url text,
  status text not null default 'pending'
    check (status in ('pending', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned')),
  estimated_delivery date,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null,
  location text,
  message text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.product_reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_item_id bigint not null unique references public.order_items(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  id boolean primary key default true check (id),
  site_name text not null default 'TSOGO-BIS',
  contact_email text,
  contact_phone text,
  base_currency char(3) not null default 'XAF',
  tax_rate numeric(6,5) not null default 0 check (tax_rate between 0 and 1),
  terms_and_policies text not null default $$DRAFT TERMS AND POLICIES — replace this text before launch.

1. Accounts: Keep your account information accurate and protect your sign-in credentials.
2. Products and prices: Product descriptions, availability, and prices may change. Prices and payment totals are shown before an order is placed.
3. Orders and payment: An order is submitted when checkout is completed. Payment must be confirmed before fulfillment begins.
4. Delivery: Delivery estimates are approximate and may change due to location, carrier, or customs delays.
5. Returns and support: Contact TSOGO-BIS support with your order details if an item arrives damaged or an order needs attention. Return eligibility will be confirmed by support.
6. Privacy: Account and order information is used to provide store services and support. Do not submit information that is not needed to complete your order.
7. Updates: These terms may be revised. The current version will be published on this page.$$,
  updated_at timestamptz not null default now()
);

create table public.currency_rates (
  base_currency char(3) not null,
  quote_currency char(3) not null,
  rate numeric(20,10) not null check (rate > 0),
  updated_at timestamptz not null default now(),
  primary key (base_currency, quote_currency),
  check (base_currency <> quote_currency)
);

insert into public.site_settings (id) values (true)
on conflict (id) do nothing;

create index products_category_status_idx on public.products(category_id, status);
create index order_items_order_id_idx on public.order_items(order_id);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index payments_order_created_idx on public.payment_attempts(order_id, created_at desc);
create index shipment_events_shipment_time_idx on public.shipment_events(shipment_id, occurred_at desc);
create index reviews_product_status_idx on public.product_reviews(product_id, status, created_at desc);
create index cart_items_user_idx on public.cart_items(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger cart_items_set_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger payment_attempts_set_updated_at before update on public.payment_attempts
  for each row execute function public.set_updated_at();
create trigger shipments_set_updated_at before update on public.shipments
  for each row execute function public.set_updated_at();
create trigger product_reviews_set_updated_at before update on public.product_reviews
  for each row execute function public.set_updated_at();
create trigger site_settings_set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, display_name, preferred_language)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    case when new.raw_user_meta_data ->> 'preferred_language' in ('en', 'fr', 'zh')
      then new.raw_user_meta_data ->> 'preferred_language' else 'fr' end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
revoke all on function public.handle_new_user() from public, anon, authenticated;

create table private.password_reset_rate_limits (
  bucket_hash text primary key check (bucket_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0),
  updated_at timestamptz not null default now()
);
create index password_reset_rate_limits_updated_at_idx
  on private.password_reset_rate_limits (updated_at);
revoke all on table private.password_reset_rate_limits from public, anon, authenticated, service_role;

create or replace function public.consume_password_reset_rate_limit(p_bucket_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_attempt_count integer;
begin
  if p_bucket_hash is null or p_bucket_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  delete from private.password_reset_rate_limits where updated_at < now() - interval '1 day';
  insert into private.password_reset_rate_limits as current_bucket
    (bucket_hash, window_started_at, attempt_count, updated_at)
  values (p_bucket_hash, now(), 1, now())
  on conflict (bucket_hash) do update set
    window_started_at = case when current_bucket.window_started_at <= now() - interval '15 minutes' then now() else current_bucket.window_started_at end,
    attempt_count = case when current_bucket.window_started_at <= now() - interval '15 minutes' then 1 else current_bucket.attempt_count + 1 end,
    updated_at = now()
  returning attempt_count into current_attempt_count;
  return current_attempt_count <= 4;
end;
$$;
revoke all on function public.consume_password_reset_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_password_reset_rate_limit(text) to service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_tags enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.product_reviews enable row level security;
alter table public.site_settings enable row level security;
alter table public.currency_rates enable row level security;

create policy "profiles read own or admin" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles update own or admin" on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "admins manage roles" on public.user_roles for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read active categories" on public.categories for select to anon, authenticated
  using (is_active);
create policy "admins manage categories" on public.categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read published products" on public.products for select to anon, authenticated
  using (status = 'published' and (select c.is_active from public.categories c where c.id = category_id) is distinct from false);
create policy "admins manage products" on public.products for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read images for published products" on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "admins manage product images" on public.product_images for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read tags for published products" on public.product_tags for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "admins manage product tags" on public.product_tags for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "users manage own cart" on public.cart_items for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "users read own orders" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "admins manage orders" on public.orders for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "users read own order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select public.is_admin()));
create policy "admins manage order items" on public.order_items for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admins manage payment attempts" on public.payment_attempts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage shipments" on public.shipments for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "users read own shipment status" on public.shipments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select public.is_admin()));
create policy "admins manage shipment events" on public.shipment_events for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "users read own shipment events" on public.shipment_events for select to authenticated
  using (exists (
    select 1 from public.shipments s join public.orders o on o.id = s.order_id
    where s.id = shipment_id and o.user_id = (select auth.uid())
  ) or (select public.is_admin()));

create policy "public read published reviews" on public.product_reviews for select to anon, authenticated
  using (status = 'published' or user_id = (select auth.uid()) or (select public.is_admin()));
create policy "verified buyers create reviews" on public.product_reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = product_reviews.order_item_id
        and oi.product_id = product_reviews.product_id
        and o.user_id = (select auth.uid()) and o.status = 'delivered'
    )
  );
create policy "users update own pending reviews" on public.product_reviews for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = product_reviews.order_item_id
        and oi.product_id = product_reviews.product_id
        and o.user_id = (select auth.uid()) and o.status = 'delivered'
    )
  );
create policy "admins manage reviews" on public.product_reviews for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read site settings" on public.site_settings for select to anon, authenticated using (true);
create policy "admins manage site settings" on public.site_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "public read currency rates" on public.currency_rates for select to anon, authenticated using (true);
create policy "admins manage currency rates" on public.currency_rates for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- RLS remains the row gate; explicit grants keep public clients read-only by default.
revoke all on public.profiles, public.user_roles, public.categories, public.products,
  public.product_images, public.product_tags, public.cart_items, public.orders,
  public.order_items, public.payment_attempts, public.shipments, public.shipment_events,
  public.product_reviews, public.site_settings, public.currency_rates from anon, authenticated;
grant select on public.categories, public.products, public.product_images, public.product_tags,
  public.product_reviews, public.site_settings, public.currency_rates to anon;
grant select, insert, update, delete on public.profiles, public.user_roles, public.categories,
  public.products, public.product_images, public.product_tags, public.cart_items, public.orders,
  public.order_items, public.payment_attempts, public.shipments, public.shipment_events,
  public.product_reviews, public.site_settings, public.currency_rates to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;
