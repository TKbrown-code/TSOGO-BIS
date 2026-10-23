-- Standardize all tracking numbers on TSB + 4 user-id chars + 8 random chars.
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

-- Replace any previously issued prefix and keep checkout/shipment links aligned.
do $$
declare
  r record;
  v_tracking text;
begin
  for r in
    select checkout_id, user_id, order_id
    from public.checkouts
    where tracking_number is not null and tracking_number !~ '^TSB[A-Z0-9]{12}$'
    order by checkout_id
  loop
    v_tracking := private.generate_checkout_tracking_number(r.user_id);
    update public.checkouts
      set tracking_number = v_tracking, tracking_link = '/track/' || v_tracking
      where checkout_id = r.checkout_id;
    if r.order_id is not null then
      update public.shipments
        set tracking_number = v_tracking, tracking_url = '/track/' || v_tracking
        where order_id = r.order_id;
    end if;
  end loop;
end;
$$;

drop function if exists public.track_shipment(text);
create function public.track_shipment(p_tracking_number text)
returns table (
  tracking_number text,
  status text,
  shipping_from text,
  present_location text,
  estimated_delivery date,
  created_at timestamptz,
  customer_name text,
  payment_status text,
  payment_method text,
  amount_paid numeric,
  total_amount numeric,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.tracking_number, s.status, coalesce(s.carrier, 'Tsogo BIS'),
    coalesce(latest.location, latest.message, 'Order confirmed'), s.estimated_delivery, s.created_at,
    o.customer_name, c.payment_status, c.payment_method,
    case when c.payment_status = 'paid' then c.total else 0::numeric end,
    c.total,
    coalesce((select jsonb_agg(jsonb_build_object(
      'name', oi.product_name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'line_total', oi.line_total,
      'image_url', img.image_url,
      'options', oi.selected_options
    ) order by oi.id)
    from public.order_items oi
    left join lateral (
      select pi.image_url from public.product_images pi
      where pi.product_id = oi.product_id
      order by pi.is_primary desc, pi.sort_order asc, pi.id asc limit 1
    ) img on true
    where oi.order_id = o.id), '[]'::jsonb)
  from public.shipments s
  join public.orders o on o.id = s.order_id
  join public.checkouts c on c.order_id = o.id
  left join lateral (
    select e.location, e.message from public.shipment_events e
    where e.shipment_id = s.id order by e.occurred_at desc limit 1
  ) latest on true
  where p_tracking_number ~* '^TSB[A-Z0-9]{12}$'
    and s.tracking_number = upper(trim(p_tracking_number));
$$;
revoke all on function public.track_shipment(text) from public;
grant execute on function public.track_shipment(text) to anon, authenticated;
comment on function public.track_shipment(text) is
  'Public tracking lookup by unguessable TSB code; returns customer display name, purchased items, total and payment summary only.';
