-- Replace legacy ST-XXXXX references with the current format:
-- TSB + first 4 characters of the customer's user ID + 8 random alphanumeric chars.
-- Keep the checkout, shipment, and public tracking URL in sync.

create schema if not exists private;

create or replace function private.generate_checkout_tracking_number(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text := 'TSB' || upper(left(replace(coalesce(p_user_id::text, '00000000'), '-', ''), 4));
  v_random bytea;
  v_code text;
  v_pos integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('checkout-tracking-number', 0));
  loop
    v_random := extensions.gen_random_bytes(8);
    v_code := v_prefix;
    for v_pos in 0..7 loop
      v_code := v_code || substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', (get_byte(v_random, v_pos) % 36) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.checkouts c where c.tracking_number = v_code)
      and not exists (select 1 from public.shipments s where s.tracking_number = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function private.generate_checkout_tracking_number(uuid) from public, anon, authenticated;

-- Make sure future successful payments use the same generator too. This replaces
-- the legacy trigger body that created ST-XXXXX codes.
create or replace function public.sync_fapshi_checkout_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_subtotal numeric(12,2);
  v_shipping numeric(12,2);
  v_status text;
  v_attempt_status text;
  v_provider text;
  v_needs_link boolean;
  v_tracking text;
  v_tracking_prefix text;
begin
  if tg_op = 'INSERT' then v_needs_link := true;
  else v_needs_link := old.order_id is null;
  end if;
  v_order_id := new.order_id;
  v_provider := case when lower(coalesce(new.payment_provider, 'fapshi')) = 'campay' then 'campay' else 'fapshi' end;

  if v_order_id is null then
    select coalesce(sum((nullif(i.value->>'price', '')::numeric) * greatest(coalesce(nullif(i.value->>'quantity', '')::integer, 1), 1)), 0)::numeric(12,2),
           coalesce(sum((nullif(i.value->>'shipping_fee', '')::numeric) * greatest(coalesce(nullif(i.value->>'quantity', '')::integer, 1), 1)), 0)::numeric(12,2)
      into v_subtotal, v_shipping
      from jsonb_array_elements(case when jsonb_typeof(new.items) = 'array' then new.items else '[]'::jsonb end) i(value);
    if coalesce(v_subtotal + v_shipping, 0) = 0 then v_subtotal := new.total; v_shipping := 0; end if;
    v_order_id := extensions.gen_random_uuid();
    v_status := case when new.payment_status = 'paid' then 'confirmed'
      when new.payment_status in ('failed', 'expired') then 'cancelled' else 'pending_payment' end;

    insert into public.orders(id, user_id, customer_name, customer_email, customer_phone,
      shipping_address, currency, subtotal, shipping_total, tax_total, grand_total, status, created_at)
    values (v_order_id, new.user_id, coalesce(new.user_name, 'Customer'), new.email,
      coalesce(new.phone_number, ''), jsonb_build_object('address', coalesce(new.address, '')),
      'XAF', v_subtotal, v_shipping, 0, new.total, v_status, new.created_at);

    insert into public.order_items(order_id, product_id, product_name, selected_options, quantity, unit_price, line_total)
    select v_order_id,
      case when coalesce(i.value->>'product_id', '') ~ '^[0-9]+$' then (i.value->>'product_id')::bigint else null end,
      coalesce(nullif(i.value->>'name', ''), 'Product'),
      jsonb_strip_nulls(jsonb_build_object('size', i.value->'size', 'color', i.value->'color')),
      greatest(coalesce(nullif(i.value->>'quantity', '')::integer, 1), 1),
      coalesce(nullif(i.value->>'price', '')::numeric, 0),
      coalesce(nullif(i.value->>'price', '')::numeric, 0) * greatest(coalesce(nullif(i.value->>'quantity', '')::integer, 1), 1)
    from jsonb_array_elements(case when jsonb_typeof(new.items) = 'array' then new.items else '[]'::jsonb end) i(value);
  end if;

  v_status := case when new.payment_status = 'paid' then 'confirmed'
    when new.payment_status in ('failed', 'expired') then 'cancelled' else 'pending_payment' end;
  v_attempt_status := case when new.payment_status = 'paid' then 'succeeded'
    when new.payment_status = 'processing' then 'processing'
    when new.payment_status in ('failed', 'expired') then 'failed' else 'pending' end;

  insert into public.payment_attempts(order_id, provider, provider_reference, idempotency_key,
    amount, currency, status, provider_payload)
  values (v_order_id, v_provider, new.payment_reference,
    coalesce(new.idempotency_key, 'legacy-checkout-' || new.checkout_id::text),
    greatest(new.total, 0.01), 'XAF', v_attempt_status,
    jsonb_strip_nulls(jsonb_build_object('checkout_id', new.checkout_id, 'payment_url', new.payment_url)))
  on conflict (idempotency_key) do update set
    provider_reference = coalesce(excluded.provider_reference, public.payment_attempts.provider_reference),
    status = case when public.payment_attempts.status = 'succeeded' then 'succeeded' else excluded.status end,
    provider_payload = public.payment_attempts.provider_payload || excluded.provider_payload,
    updated_at = now();

  update public.orders set status = case
    when status in ('shipped', 'delivered', 'refunded') then status else v_status end,
    updated_at = now()
  where id = v_order_id;

  if new.payment_status = 'paid' then
    v_tracking_prefix := 'TSB' || upper(left(replace(coalesce(new.user_id::text, '00000000'), '-', ''), 4));
    v_tracking := case
      when new.tracking_number ~ ('^' || v_tracking_prefix || '[A-Z0-9]{8}$') then new.tracking_number
      else private.generate_checkout_tracking_number(new.user_id)
    end;
    update public.checkouts set
      payment_method = case when lower(coalesce(payment_provider, 'fapshi')) in ('card', 'bank') then 'Bank' else 'Mobile Payment' end,
      tracking_number = v_tracking,
      tracking_link = coalesce(nullif(tracking_link, ''), '/track/' || v_tracking)
    where checkout_id = new.checkout_id;

    insert into public.shipments(order_id, carrier, tracking_number, tracking_url, status)
    values (v_order_id, 'Tsogo BIS', v_tracking, '/track/' || v_tracking, 'pending')
    on conflict (order_id) do update set
      tracking_number = excluded.tracking_number,
      tracking_url = excluded.tracking_url,
      updated_at = now();

    insert into public.shipment_events(shipment_id, status, location, message)
    select s.id, 'pending', 'Tsogo BIS', 'Payment received; preparing your order.'
    from public.shipments s where s.order_id = v_order_id
      and not exists (select 1 from public.shipment_events e where e.shipment_id = s.id and e.status = 'pending');
  end if;

  if v_needs_link then
    update public.checkouts set order_id = v_order_id
    where checkout_id = new.checkout_id and order_id is distinct from v_order_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_fapshi_checkout_order() from public, anon, authenticated;
grant execute on function public.sync_fapshi_checkout_order() to service_role;

drop trigger if exists sync_fapshi_checkout_order_trigger on public.checkouts;
create trigger sync_fapshi_checkout_order_trigger
after insert or update of payment_status, payment_reference, payment_url, payment_provider, order_id
on public.checkouts
for each row execute function public.sync_fapshi_checkout_order();

do $$
declare
  r record;
  v_tracking text;
begin
  for r in
    select c.checkout_id, c.user_id, c.order_id, c.tracking_number
    from public.checkouts c
    where c.tracking_number is not null
      and c.tracking_number !~ ('^TSB' || upper(left(replace(coalesce(c.user_id::text, '00000000'), '-', ''), 4)) || '[A-Z0-9]{8}$')
    order by c.checkout_id
  loop
    v_tracking := private.generate_checkout_tracking_number(r.user_id);

    -- Change the shipment first so the unique shipment tracking constraint stays satisfied.
    if r.order_id is not null then
      update public.shipments
      set tracking_number = v_tracking,
          tracking_url = '/track/' || v_tracking,
          updated_at = now()
      where order_id = r.order_id;
    end if;

    update public.checkouts
    set tracking_number = v_tracking,
        tracking_link = '/track/' || v_tracking
    where checkout_id = r.checkout_id;
  end loop;
end;
$$;

-- Repair any shipment records that have no matching checkout, or whose code drifted.
do $$
declare
  r record;
  v_tracking text;
begin
  for r in
    select s.id, o.user_id, c.checkout_id
    from public.shipments s
    join public.orders o on o.id = s.order_id
    left join public.checkouts c on c.order_id = s.order_id
    where s.tracking_number is not null
      and not exists (
        select 1 from public.checkouts cx
        where cx.order_id = s.order_id
          and cx.tracking_number ~ ('^TSB' || upper(left(replace(coalesce(o.user_id::text, '00000000'), '-', ''), 4)) || '[A-Z0-9]{8}$')
      )
    order by s.id
  loop
    v_tracking := private.generate_checkout_tracking_number(r.user_id);
    update public.shipments
    set tracking_number = v_tracking,
        tracking_url = '/track/' || v_tracking,
        updated_at = now()
    where id = r.id;

    if r.checkout_id is not null then
      update public.checkouts
      set tracking_number = v_tracking,
          tracking_link = '/track/' || v_tracking
      where checkout_id = r.checkout_id;
    end if;
  end loop;
end;
$$;

-- Keep valid codes from this user's ID prefix and repair their links as well.
update public.checkouts c
set tracking_link = '/track/' || c.tracking_number
where c.tracking_number ~ ('^TSB' || upper(left(replace(coalesce(c.user_id::text, '00000000'), '-', ''), 4)) || '[A-Z0-9]{8}$')
  and c.tracking_link is distinct from '/track/' || c.tracking_number;

update public.shipments s
set tracking_url = '/track/' || s.tracking_number,
    updated_at = now()
from public.checkouts c
where c.order_id = s.order_id
  and c.tracking_number = s.tracking_number
  and c.tracking_number ~ ('^TSB' || upper(left(replace(coalesce(c.user_id::text, '00000000'), '-', ''), 4)) || '[A-Z0-9]{8}$')
  and s.tracking_url is distinct from '/track/' || s.tracking_number;

-- Admin edits must update both copies atomically so public tracking stays searchable.
create or replace function public.admin_update_checkout_tracking(
  p_checkout_id bigint,
  p_tracking_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_order_id uuid;
  v_shipment_id uuid;
  v_tracking text := nullif(upper(trim(p_tracking_number)), '');
  v_prefix text;
  v_status text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select c.user_id, c.order_id, c.delivery_status
    into v_user_id, v_order_id, v_status
  from public.checkouts c
  where c.checkout_id = p_checkout_id
  for update;

  if not found then
    raise exception 'Checkout not found' using errcode = 'P0002';
  end if;

  v_prefix := 'TSB' || upper(left(replace(coalesce(v_user_id::text, '00000000'), '-', ''), 4));
  if v_tracking is not null and v_tracking !~ ('^' || v_prefix || '[A-Z0-9]{8}$') then
    raise exception 'Tracking number must use the format % followed by eight letters or numbers', v_prefix
      using errcode = '22023';
  end if;

  update public.checkouts
  set tracking_number = v_tracking,
      tracking_link = case when v_tracking is null then null else '/track/' || v_tracking end
  where checkout_id = p_checkout_id;

  if v_order_id is not null then
    select s.id into v_shipment_id
    from public.shipments s
    where s.order_id = v_order_id
    for update;

    if v_shipment_id is null and v_tracking is not null then
      insert into public.shipments(order_id, carrier, tracking_number, tracking_url, status)
      values (v_order_id, 'Tsogo BIS', v_tracking, '/track/' || v_tracking,
        case v_status
          when 'processing' then 'processing'
          when 'shipped' then 'in_transit'
          when 'in_transit' then 'in_transit'
          when 'out_for_delivery' then 'out_for_delivery'
          when 'delivered' then 'delivered'
          else 'pending'
        end);
    elsif v_shipment_id is not null then
      update public.shipments
      set tracking_number = v_tracking,
          tracking_url = case when v_tracking is null then null else '/track/' || v_tracking end,
          updated_at = now()
      where id = v_shipment_id;
    end if;
  end if;
end;
$$;

revoke all on function public.admin_update_checkout_tracking(bigint, text) from public, anon;
grant execute on function public.admin_update_checkout_tracking(bigint, text) to authenticated;
