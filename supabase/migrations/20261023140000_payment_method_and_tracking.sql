-- Assign the payment type and tracking details atomically when payment succeeds.
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
  v_random bytea;
  v_char_index integer;
  v_char_position integer;
begin
  if tg_op = 'INSERT' then
    v_needs_link := true;
  else
    v_needs_link := old.order_id is null;
  end if;
  v_order_id := new.order_id;
  v_provider := case when lower(coalesce(new.payment_provider, 'fapshi')) = 'campay' then 'campay' else 'fapshi' end;

  if v_order_id is null then
    select coalesce(sum((nullif(i.value->>'price', '')::numeric) * greatest(coalesce(nullif(i.value->>'quantity', '')::integer, 1), 1)), 0)::numeric(12,2),
           coalesce(sum((nullif(i.value->>'shipping_fee', '')::numeric) * greatest(coalesce(nullif(i.value->>'quantity', '')::integer, 1), 1)), 0)::numeric(12,2)
      into v_subtotal, v_shipping
      from jsonb_array_elements(case when jsonb_typeof(new.items) = 'array' then new.items else '[]'::jsonb end) i(value);
    if coalesce(v_subtotal + v_shipping, 0) = 0 then
      v_subtotal := new.total;
      v_shipping := 0;
    end if;
    v_order_id := extensions.gen_random_uuid();
    v_status := case when new.payment_status = 'paid' then 'confirmed'
      when new.payment_status in ('failed', 'expired') then 'cancelled' else 'pending_payment' end;

    insert into public.orders(id, user_id, customer_name, customer_email, customer_phone,
      shipping_address, currency, subtotal, shipping_total, tax_total, grand_total, status, created_at)
    values (v_order_id, new.user_id, coalesce(new.user_name, 'Customer'), new.email,
      coalesce(new.phone_number, ''), jsonb_build_object('address', coalesce(new.address, '')),
      'XAF', v_subtotal, v_shipping, 0, new.total, v_status, new.created_at);

    insert into public.order_items(order_id, product_id, product_name, selected_options,
      quantity, unit_price, line_total)
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
    when status in ('shipped', 'delivered', 'refunded') then status
    else v_status end,
    updated_at = now()
  where id = v_order_id;

  if new.payment_status = 'paid' then
    -- Serialize number allocation, then check existing numbers before use.
    perform pg_advisory_xact_lock(hashtextextended('checkout-tracking-number', 0));
    if new.tracking_number is null or new.tracking_number = '' then
      loop
        v_random := extensions.gen_random_bytes(5);
        v_tracking := 'ST-';
        for v_char_position in 0..4 loop
          v_char_index := (get_byte(v_random, v_char_position) % 32) + 1;
          v_tracking := v_tracking || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', v_char_index, 1);
        end loop;
        exit when not exists (select 1 from public.checkouts c where c.tracking_number = v_tracking);
      end loop;
    else
      v_tracking := new.tracking_number;
    end if;

    update public.checkouts set
      payment_method = case when lower(coalesce(payment_provider, 'fapshi')) in ('card', 'bank')
        then 'Bank' else 'Mobile Payment' end,
      tracking_number = coalesce(nullif(tracking_number, ''), v_tracking),
      tracking_link = coalesce(nullif(tracking_link, ''), '/track/' || coalesce(nullif(tracking_number, ''), v_tracking))
    where checkout_id = new.checkout_id;

    insert into public.shipments(order_id, carrier, tracking_number, tracking_url, status)
    values (v_order_id, 'Tsogo BIS', v_tracking, '/track/' || v_tracking, 'pending')
    on conflict (order_id) do nothing;

    insert into public.shipment_events(shipment_id, status, location, message)
    select s.id, 'pending', 'Tsogo BIS', 'Payment received; preparing your order.'
    from public.shipments s
    where s.order_id = v_order_id
      and not exists (select 1 from public.shipment_events e where e.shipment_id = s.id and e.status = 'pending');
  end if;

  if v_needs_link then
    update public.checkouts set order_id = v_order_id where checkout_id = new.checkout_id and order_id is distinct from v_order_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_fapshi_checkout_order() from public, anon, authenticated;
grant execute on function public.sync_fapshi_checkout_order() to service_role;

-- Public tracking lookup returns only shipment status details for an exact code.
-- This avoids exposing the full shipments table or customer/order data.
create or replace function public.track_shipment(p_tracking_number text)
returns table (
  tracking_number text,
  status text,
  shipping_from text,
  present_location text,
  estimated_delivery date,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.tracking_number,
         s.status,
         coalesce(s.carrier, 'Tsogo BIS'),
         coalesce(latest.location, latest.message, 'Order confirmed'),
         s.estimated_delivery,
         s.created_at
  from public.shipments s
  left join lateral (
    select e.location, e.message
    from public.shipment_events e
    where e.shipment_id = s.id
    order by e.occurred_at desc
    limit 1
  ) latest on true
  where p_tracking_number ~* '^ST-[A-Z0-9]{5}$'
    and s.tracking_number = upper(trim(p_tracking_number));
$$;
revoke all on function public.track_shipment(text) from public;
grant execute on function public.track_shipment(text) to anon, authenticated;

-- Backfill payment/tracking details for checkouts already confirmed as paid.
update public.checkouts set payment_status = payment_status
where payment_status = 'paid'
  and (tracking_number is null or tracking_number = '' or payment_method is null);
