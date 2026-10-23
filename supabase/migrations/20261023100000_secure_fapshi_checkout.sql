-- Fapshi checkout hardening for the legacy checkouts/checkout_items schema.
-- This also creates the checkout tables expected by this app when the active DB
-- was bootstrapped from schema-v2.sql (which has orders/order_items instead).

alter table public.products
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists weight numeric(12,3),
  add column if not exists weight_grams integer,
  add column if not exists options jsonb not null default '{}'::jsonb,
  add column if not exists shipping_methods jsonb not null default '[]'::jsonb;

create table if not exists public.checkouts (
  checkout_id bigint generated always as identity primary key,
  id bigint generated always as identity unique,
  user_id uuid references auth.users(id) on delete set null,
  visitor_id text,
  user_name text not null,
  email text,
  phone_number text not null,
  address text not null,
  total numeric(12,2) not null check (total > 0),
  items jsonb not null default '[]'::jsonb,
  payment_method text,
  status text not null default 'pending',
  delivery_status text not null default 'pending',
  tracking_number text,
  tracking_link text,
  created_at timestamptz not null default now()
);

create table if not exists public.checkout_items (
  id bigint generated always as identity primary key,
  checkout_id bigint not null references public.checkouts(checkout_id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  quantity integer not null check (quantity between 1 and 99),
  price numeric(12,2) not null check (price >= 0),
  size text,
  color text,
  shipping_method text,
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  created_at timestamptz not null default now()
);

create index if not exists checkouts_user_created_idx on public.checkouts(user_id, created_at desc);
create index if not exists checkout_items_checkout_id_idx on public.checkout_items(checkout_id);
alter table public.checkouts enable row level security;
alter table public.checkout_items enable row level security;
drop policy if exists "users read own checkouts" on public.checkouts;
create policy "users read own checkouts" on public.checkouts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "admins manage checkouts" on public.checkouts;
create policy "admins manage checkouts" on public.checkouts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "users read own checkout items" on public.checkout_items;
create policy "users read own checkout items" on public.checkout_items for select to authenticated
  using (exists (select 1 from public.checkouts c where c.checkout_id = checkout_items.checkout_id and c.user_id = (select auth.uid()))
    or (select public.is_admin()));
drop policy if exists "admins manage checkout items" on public.checkout_items;
create policy "admins manage checkout items" on public.checkout_items for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.checkouts, public.checkout_items from anon, authenticated;
grant select, insert, update, delete on public.checkouts, public.checkout_items to authenticated;
grant all on public.checkouts, public.checkout_items to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter table public.checkouts
  add column if not exists email text,
  add column if not exists idempotency_key text,
  add column if not exists payment_provider text,
  add column if not exists payment_reference text,
  add column if not exists payment_url text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists inventory_reserved boolean not null default false;

create unique index if not exists checkouts_user_idempotency_key_uidx
  on public.checkouts(user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists checkouts_payment_reference_uidx
  on public.checkouts(payment_reference)
  where payment_reference is not null;

alter table public.checkouts drop constraint if exists checkouts_payment_status_check;
alter table public.checkouts add constraint checkouts_payment_status_check
  check (payment_status in ('initiating', 'pending', 'processing', 'paid', 'failed', 'expired'));

create or replace function public.create_fapshi_checkout(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_cart_item_ids bigint[],
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout public.checkouts%rowtype;
  v_total numeric(12,2);
  v_lines jsonb;
  v_item record;
begin
  if p_user_id is null or p_name is null or length(trim(p_name)) not between 1 and 160
    or p_email is null or length(trim(p_email)) > 320
    or p_phone is null or length(trim(p_phone)) not between 6 and 40
    or p_address is null or length(trim(p_address)) not between 3 and 1000
    or p_idempotency_key is null or length(p_idempotency_key) not between 16 and 100
    or coalesce(array_length(p_cart_item_ids, 1), 0) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'Invalid checkout details';
  end if;

  -- A per-user lock makes concurrent retries of one browser request converge.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_idempotency_key, 0));
  select * into v_checkout from public.checkouts
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('checkout_id', v_checkout.checkout_id, 'total', v_checkout.total,
      'payment_status', v_checkout.payment_status, 'payment_url', v_checkout.payment_url,
      'payment_reference', v_checkout.payment_reference, 'reused', true);
  end if;

  -- Lock product rows in a stable order before validating and decrementing stock.
  perform p.id from public.products p
    join (select distinct ci.product_id from public.cart_items ci
          where ci.user_id = p_user_id and ci.id = any(p_cart_item_ids)) x on x.product_id = p.id
    order by p.id for update of p;

  if (select count(*) from public.cart_items ci
      where ci.user_id = p_user_id and ci.id = any(p_cart_item_ids)) <> cardinality(p_cart_item_ids) then
    raise exception using errcode = '22023', message = 'One or more selected cart items are unavailable';
  end if;

  if exists (
    select 1 from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.user_id = p_user_id and ci.id = any(p_cart_item_ids)
    group by p.id, p.stock_quantity
    having sum(ci.quantity) > coalesce(p.stock_quantity, 0)
  ) then
    raise exception using errcode = 'P0001', message = 'One or more products no longer have enough stock';
  end if;

  select coalesce(sum(ci.quantity * (p.price + coalesce(nullif(opt.option_data->>'extraPrice', '')::numeric,
           nullif(opt.option_data->>'added_price', '')::numeric, 0) + coalesce(ship.shipping_fee, 0))), 0)::numeric(12,2),
         jsonb_agg(jsonb_build_object('product_id', p.id, 'name', p.name,
           'quantity', ci.quantity,
           'price', p.price + coalesce(nullif(opt.option_data->>'extraPrice', '')::numeric,
             nullif(opt.option_data->>'added_price', '')::numeric, 0),
           'shipping_fee', coalesce(ship.shipping_fee, 0),
           'size', coalesce(ci.selected_options->>'selectedSize', ci.selected_options->>'sizes'),
           'color', ci.selected_options->>'selectedColor') order by ci.id)
    into v_total, v_lines
    from public.cart_items ci join public.products p on p.id = ci.product_id
    left join lateral (
      select grp.value -> (ci.selected_options ->> grp.key) as option_data
      from jsonb_each(coalesce(p.options, '{}'::jsonb)) grp
      where ci.selected_options ? grp.key
        and grp.value ? (ci.selected_options ->> grp.key)
      limit 1
    ) opt on true
    left join lateral (
      select (case
        when jsonb_typeof(p.shipping_methods) = 'object'
          then coalesce(nullif(p.shipping_methods ->> (ci.selected_options ->> 'shipping_method'), '')::numeric, 0)
        when jsonb_typeof(p.shipping_methods) = 'array' then coalesce((
          select nullif(coalesce(method_row.value->>'price', method_row.value->>'fee', method_row.value->>'rate'), '')::numeric
          from jsonb_array_elements(p.shipping_methods) method_row(value)
          where lower(coalesce(method_row.value->>'name', method_row.value->>'method', method_row.value->>'label'))
            = lower(ci.selected_options ->> 'shipping_method')
          limit 1
        ), 0)
        else 0 end)
        * (coalesce(nullif(p.weight::text, '')::numeric, p.weight_grams::numeric / 1000, 0)
           + coalesce(nullif(opt.option_data->>'extraWeight', '')::numeric,
             nullif(opt.option_data->>'extra_weight', '')::numeric, 0)) as shipping_fee
    ) ship on true
    where ci.user_id = p_user_id and ci.id = any(p_cart_item_ids);
  if v_total <= 0 then
    raise exception using errcode = '22023', message = 'Order total must be greater than zero';
  end if;

  for v_item in
    select ci.product_id, sum(ci.quantity)::integer as quantity
      from public.cart_items ci
      where ci.user_id = p_user_id and ci.id = any(p_cart_item_ids)
      group by ci.product_id order by ci.product_id
  loop
    update public.products set stock_quantity = coalesce(stock_quantity, 0) - v_item.quantity
      where id = v_item.product_id;
  end loop;

  insert into public.checkouts(user_name, email, phone_number, address, total, user_id,
    items, status, payment_provider, payment_status, idempotency_key, inventory_reserved)
  values (trim(p_name), lower(trim(p_email)), trim(p_phone), trim(p_address), v_total,
    p_user_id, v_lines, 'pending', 'fapshi', 'initiating', p_idempotency_key, true);
  select * into v_checkout from public.checkouts
    where user_id = p_user_id and idempotency_key = p_idempotency_key;

  insert into public.checkout_items(checkout_id, product_id, quantity, price, size, color, shipping_method, shipping_fee)
    select v_checkout.checkout_id, p.id, ci.quantity,
      p.price + coalesce(nullif(opt.option_data->>'extraPrice', '')::numeric,
        nullif(opt.option_data->>'added_price', '')::numeric, 0),
      coalesce(ci.selected_options->>'selectedSize', ci.selected_options->>'sizes'),
      coalesce(ci.selected_options->>'selectedColor', ci.selected_options->>'colors'),
      ci.selected_options->>'shipping_method', coalesce(ship.shipping_fee, 0)
    from public.cart_items ci join public.products p on p.id = ci.product_id
    left join lateral (
      select grp.value -> (ci.selected_options ->> grp.key) as option_data
      from jsonb_each(coalesce(p.options, '{}'::jsonb)) grp
      where ci.selected_options ? grp.key
        and grp.value ? (ci.selected_options ->> grp.key)
      limit 1
    ) opt on true
    left join lateral (
      select (case
        when jsonb_typeof(p.shipping_methods) = 'object'
          then coalesce(nullif(p.shipping_methods ->> (ci.selected_options ->> 'shipping_method'), '')::numeric, 0)
        when jsonb_typeof(p.shipping_methods) = 'array' then coalesce((
          select nullif(coalesce(method_row.value->>'price', method_row.value->>'fee', method_row.value->>'rate'), '')::numeric
          from jsonb_array_elements(p.shipping_methods) method_row(value)
          where lower(coalesce(method_row.value->>'name', method_row.value->>'method', method_row.value->>'label'))
            = lower(ci.selected_options ->> 'shipping_method')
          limit 1
        ), 0)
        else 0 end)
        * (coalesce(nullif(p.weight::text, '')::numeric, p.weight_grams::numeric / 1000, 0)
           + coalesce(nullif(opt.option_data->>'extraWeight', '')::numeric,
             nullif(opt.option_data->>'extra_weight', '')::numeric, 0)) as shipping_fee
    ) ship on true
    where ci.user_id = p_user_id and ci.id = any(p_cart_item_ids);

  return jsonb_build_object('checkout_id', v_checkout.checkout_id, 'total', v_total,
    'payment_status', v_checkout.payment_status, 'payment_url', null,
    'payment_reference', null, 'reused', false);
end;
$$;

create or replace function public.set_fapshi_checkout_payment(
  p_checkout_id text,
  p_payment_status text,
  p_payment_reference text default null,
  p_payment_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout public.checkouts%rowtype;
  v_status text;
begin
  v_status := case p_payment_status
    when 'SUCCESSFUL' then 'paid'
    when 'FAILED' then 'failed'
    when 'EXPIRED' then 'expired'
    when 'PENDING' then 'processing'
    when 'CREATED' then 'pending'
    else null end;
  if v_status is null then raise exception using errcode = '22023', message = 'Unknown Fapshi status'; end if;

  select * into v_checkout from public.checkouts
    where checkout_id::text = p_checkout_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Checkout not found'; end if;

  -- Terminal payment states cannot be rolled back by delayed duplicate webhooks.
  if v_checkout.payment_status = 'paid' then
    return jsonb_build_object('checkout_id', v_checkout.checkout_id, 'payment_status', 'paid');
  end if;
  if v_checkout.payment_status in ('failed', 'expired') and v_status in ('pending', 'processing') then
    update public.checkouts set payment_reference = coalesce(p_payment_reference, payment_reference),
      payment_url = coalesce(p_payment_url, payment_url)
      where checkout_id = v_checkout.checkout_id;
    return jsonb_build_object('checkout_id', v_checkout.checkout_id, 'payment_status', v_checkout.payment_status);
  end if;

  update public.checkouts set
    payment_status = v_status,
    status = case when v_status = 'paid' then 'paid' else status end,
    payment_reference = coalesce(p_payment_reference, payment_reference),
    payment_url = coalesce(p_payment_url, payment_url),
    inventory_reserved = case when v_status in ('paid', 'failed', 'expired') then false else inventory_reserved end
    where checkout_id = v_checkout.checkout_id;

  if v_status in ('failed', 'expired') and v_checkout.inventory_reserved then
    update public.products p set stock_quantity = coalesce(p.stock_quantity, 0) + lines.quantity
      from (select product_id, sum(quantity)::integer quantity from public.checkout_items
            where checkout_id = v_checkout.checkout_id and product_id is not null group by product_id) lines
      where p.id = lines.product_id;
  end if;
  return jsonb_build_object('checkout_id', v_checkout.checkout_id, 'payment_status', v_status);
end;
$$;

revoke all on function public.create_fapshi_checkout(uuid, text, text, text, text, bigint[], text) from public, anon, authenticated;
revoke all on function public.set_fapshi_checkout_payment(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_fapshi_checkout(uuid, text, text, text, text, bigint[], text) to service_role;
grant execute on function public.set_fapshi_checkout_payment(text, text, text, text) to service_role;
