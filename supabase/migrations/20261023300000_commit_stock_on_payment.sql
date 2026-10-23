-- Do not let unpaid checkouts reduce product stock. Stock is committed only
-- when payment succeeds, and is restored if a committed order is cancelled.
-- Keep this migration safe if the earlier delivery-fee migration was not applied.
alter table public.checkouts
  add column if not exists shipping_payment_mode text not null default 'arrival',
  add column if not exists shipping_due_on_delivery numeric(12,2) not null default 0;

-- Return stock held by old unpaid checkouts before clearing their old reservations.
update public.products p
set stock_quantity = coalesce(p.stock_quantity, 0) + lines.quantity
from (
  select ci.product_id, sum(ci.quantity)::integer as quantity
  from public.checkouts c
  join public.checkout_items ci on ci.checkout_id = c.checkout_id
  where c.inventory_reserved = true
    and c.payment_status <> 'paid'
  group by ci.product_id
) lines
where p.id = lines.product_id;

-- The flag now means that stock has actually been deducted for a paid order.
update public.checkouts
set inventory_reserved = (payment_status = 'paid');

create or replace function public.sync_checkout_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.inventory_reserved
    and new.status = 'cancelled' and old.status is distinct from 'cancelled'
    and new.payment_status not in ('failed', 'expired') then
    update public.products p
    set stock_quantity = coalesce(p.stock_quantity, 0) + lines.quantity
    from (
      select ci.product_id, sum(ci.quantity)::integer as quantity
      from public.checkout_items ci
      where ci.checkout_id = old.checkout_id and ci.product_id is not null
      group by ci.product_id
    ) lines
    where p.id = lines.product_id;
    new.inventory_reserved := false;
    return new;
  end if;

  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid'
    and not old.inventory_reserved then
    update public.products p
    set stock_quantity = greatest(0, coalesce(p.stock_quantity, 0) - lines.quantity)
    from (
      select ci.product_id, sum(ci.quantity)::integer as quantity
      from public.checkout_items ci
      where ci.checkout_id = new.checkout_id and ci.product_id is not null
      group by ci.product_id
      order by ci.product_id
    ) lines
    where p.id = lines.product_id;
    new.inventory_reserved := true;
  elsif old.inventory_reserved and new.payment_status = 'paid' then
    -- Preserve the committed flag when the payment RPC writes false on success.
    new.inventory_reserved := true;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_checkout_inventory_trigger on public.checkouts;
create trigger sync_checkout_inventory_trigger
before update of status, payment_status, inventory_reserved on public.checkouts
for each row execute function public.sync_checkout_inventory();

-- The checkout RPC still validates that the order is in stock at submission,
-- but no longer subtracts stock or marks it reserved before payment.
create or replace function public.create_fapshi_checkout(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_cart_item_ids bigint[],
  p_idempotency_key text,
  p_shipping_payment_mode text default 'arrival'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout public.checkouts%rowtype;
  v_total numeric(12,2);
  v_shipping_total numeric(12,2);
  v_lines jsonb;
begin
  if p_user_id is null or p_name is null or length(trim(p_name)) not between 1 and 160
    or p_email is null or length(trim(p_email)) > 320
    or p_phone is null or length(trim(p_phone)) not between 6 and 40
    or p_address is null or length(trim(p_address)) not between 3 and 1000
    or p_idempotency_key is null or length(p_idempotency_key) not between 16 and 100
    or coalesce(p_shipping_payment_mode, 'arrival') not in ('arrival', 'online')
    or coalesce(array_length(p_cart_item_ids, 1), 0) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'Invalid checkout details';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_idempotency_key, 0));
  select * into v_checkout from public.checkouts
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('checkout_id', v_checkout.checkout_id, 'total', v_checkout.total,
      'payment_status', v_checkout.payment_status, 'payment_url', v_checkout.payment_url,
      'payment_reference', v_checkout.payment_reference,
      'shipping_due_on_delivery', coalesce(v_checkout.shipping_due_on_delivery, 0), 'reused', true);
  end if;

  -- Read stock under row locks to avoid accepting an order already out of stock.
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
           nullif(opt.option_data->>'added_price', '')::numeric, 0) + case when coalesce(p_shipping_payment_mode, 'arrival') = 'online' then coalesce(ship.shipping_fee, 0) else 0 end)), 0)::numeric(12,2),
         coalesce(sum(ci.quantity * coalesce(ship.shipping_fee, 0)), 0)::numeric(12,2),
         jsonb_agg(jsonb_build_object('product_id', p.id, 'name', p.name,
           'quantity', ci.quantity,
           'price', p.price + coalesce(nullif(opt.option_data->>'extraPrice', '')::numeric,
             nullif(opt.option_data->>'added_price', '')::numeric, 0),
           'shipping_method', ci.selected_options->>'shipping_method',
           'shipping_fee', coalesce(ship.shipping_fee, 0),
           'size', coalesce(ci.selected_options->>'selectedSize', ci.selected_options->>'sizes'),
           'color', ci.selected_options->>'selectedColor') order by ci.id)
  into v_total, v_shipping_total, v_lines
  from public.cart_items ci join public.products p on p.id = ci.product_id
  left join lateral (
    select grp.value -> (ci.selected_options ->> grp.key) as option_data
    from jsonb_each(coalesce(p.options, '{}'::jsonb)) grp
    where ci.selected_options ? grp.key and grp.value ? (ci.selected_options ->> grp.key)
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
          = lower(ci.selected_options ->> 'shipping_method') limit 1
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

  insert into public.checkouts(user_name, email, phone_number, address, total, user_id,
    items, status, payment_provider, payment_status, idempotency_key, inventory_reserved,
    shipping_payment_mode, shipping_due_on_delivery)
  values (trim(p_name), lower(trim(p_email)), trim(p_phone), trim(p_address), v_total,
    p_user_id, v_lines, 'pending', 'fapshi', 'initiating', p_idempotency_key, false,
    coalesce(p_shipping_payment_mode, 'arrival'),
    case when coalesce(p_shipping_payment_mode, 'arrival') = 'arrival' then v_shipping_total else 0 end)
  returning * into v_checkout;

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
    where ci.selected_options ? grp.key and grp.value ? (ci.selected_options ->> grp.key)
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
          = lower(ci.selected_options ->> 'shipping_method') limit 1
      ), 0)
      else 0 end)
      * (coalesce(nullif(p.weight::text, '')::numeric, p.weight_grams::numeric / 1000, 0)
         + coalesce(nullif(opt.option_data->>'extraWeight', '')::numeric,
           nullif(opt.option_data->>'extra_weight', '')::numeric, 0)) as shipping_fee
  ) ship on true
  where ci.user_id = p_user_id and ci.id = any(p_cart_item_ids);

  return jsonb_build_object('checkout_id', v_checkout.checkout_id, 'total', v_total,
    'shipping_due_on_delivery', case when coalesce(p_shipping_payment_mode, 'arrival') = 'arrival' then v_shipping_total else 0 end,
    'payment_status', v_checkout.payment_status, 'payment_url', null,
    'payment_reference', null, 'reused', false);
end;
$$;

revoke all on function public.create_fapshi_checkout(uuid, text, text, text, text, bigint[], text, text) from public, anon, authenticated;
grant execute on function public.create_fapshi_checkout(uuid, text, text, text, text, bigint[], text, text) to service_role;
