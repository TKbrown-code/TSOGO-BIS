-- Keep the admin delivery workflow and public tracking timeline in sync.
alter table public.shipments drop constraint if exists shipments_status_check;
alter table public.shipments
  add constraint shipments_status_check
  check (status in ('pending', 'processing', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'));

-- Repair any drift from the former admin-only checkout status updates.
update public.shipments s
set status = case c.delivery_status
  when 'pending' then 'pending'
  when 'processing' then 'processing'
  when 'shipped' then 'in_transit'
  when 'in_transit' then 'in_transit'
  when 'out_for_delivery' then 'out_for_delivery'
  when 'delivered' then 'delivered'
  else 'pending'
end,
updated_at = now()
from public.checkouts c
where c.order_id = s.order_id;

create or replace function public.admin_update_shipment_status(
  p_checkout_id bigint,
  p_status text,
  p_location text default null,
  p_estimated_delivery date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_shipment_id uuid;
  v_previous_status text;
  v_previous_location text;
  v_message text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('pending', 'processing', 'in_transit', 'out_for_delivery', 'delivered') then
    raise exception 'Invalid delivery status' using errcode = '22023';
  end if;

  select c.order_id into v_order_id
  from public.checkouts c
  where c.checkout_id = p_checkout_id
  for update;

  if v_order_id is null then
    raise exception 'Checkout or linked order not found' using errcode = 'P0002';
  end if;

  select s.id, s.status into v_shipment_id, v_previous_status
  from public.shipments s
  where s.order_id = v_order_id
  for update;

  if v_shipment_id is null then
    raise exception 'Shipment record not found for this checkout' using errcode = 'P0002';
  end if;

  select e.location into v_previous_location
  from public.shipment_events e
  where e.shipment_id = v_shipment_id
  order by e.occurred_at desc
  limit 1;

  update public.checkouts
  set delivery_status = p_status
  where checkout_id = p_checkout_id;

  update public.shipments
  set status = p_status,
      estimated_delivery = p_estimated_delivery,
      shipped_at = case when p_status in ('in_transit', 'out_for_delivery', 'delivered') then coalesce(shipped_at, now()) else shipped_at end,
      delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else null end,
      updated_at = now()
  where id = v_shipment_id;

  if v_previous_status is distinct from p_status or nullif(trim(p_location), '') is distinct from v_previous_location then
    v_message := case when v_previous_status is distinct from p_status then case p_status
      when 'pending' then 'Your order is awaiting preparation.'
      when 'processing' then 'Your order is being prepared.'
      when 'in_transit' then 'Your order is in transit.'
      when 'out_for_delivery' then 'Your order is out for delivery.'
      when 'delivered' then 'Your order has been delivered.'
    end else 'Shipment details updated.' end;
    insert into public.shipment_events(shipment_id, status, location, message)
    values (v_shipment_id, p_status, coalesce(nullif(trim(p_location), ''), v_previous_location, 'Tsogo BIS'), v_message);
  end if;
end;
$$;

revoke all on function public.admin_update_shipment_status(bigint, text, text, date) from public, anon;
grant execute on function public.admin_update_shipment_status(bigint, text, text, date) to authenticated;
