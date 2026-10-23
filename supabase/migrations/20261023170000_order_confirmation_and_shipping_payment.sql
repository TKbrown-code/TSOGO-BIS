-- Durable, retryable queue for payment confirmation emails.
create table if not exists public.order_confirmation_email_jobs (
  checkout_id bigint primary key references public.checkouts(checkout_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.order_confirmation_email_jobs enable row level security;
revoke all on public.order_confirmation_email_jobs from public, anon, authenticated;
grant all on public.order_confirmation_email_jobs to service_role;

create or replace function private.queue_order_confirmation_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    insert into public.order_confirmation_email_jobs(checkout_id)
    values (new.checkout_id)
    on conflict (checkout_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_order_confirmation_email() from public, anon, authenticated;
drop trigger if exists queue_order_confirmation_email_trigger on public.checkouts;
create trigger queue_order_confirmation_email_trigger
after update of payment_status on public.checkouts
for each row execute function private.queue_order_confirmation_email();

-- Include checkouts that were paid before the queue was installed.
insert into public.order_confirmation_email_jobs(checkout_id)
select checkout_id from public.checkouts where payment_status = 'paid'
on conflict (checkout_id) do nothing;

create or replace function public.claim_order_confirmation_email(p_checkout_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean;
begin
  update public.order_confirmation_email_jobs
    set status = 'sending', attempts = attempts + 1, last_error = null, updated_at = now()
    where checkout_id = p_checkout_id
      and (status in ('pending', 'failed') or (status = 'sending' and updated_at < now() - interval '10 minutes'))
    returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

create or replace function public.finish_order_confirmation_email(p_checkout_id bigint, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.order_confirmation_email_jobs
    set status = case when p_error is null then 'sent' else 'failed' end,
        sent_at = case when p_error is null then now() else sent_at end,
        last_error = case when p_error is null then null else left(p_error, 1000) end,
        updated_at = now()
    where checkout_id = p_checkout_id;
end;
$$;
revoke all on function public.claim_order_confirmation_email(bigint) from public, anon, authenticated;
revoke all on function public.finish_order_confirmation_email(bigint, text) from public, anon, authenticated;
grant execute on function public.claim_order_confirmation_email(bigint) to service_role;
grant execute on function public.finish_order_confirmation_email(bigint, text) to service_role;

-- Extend the public tracking RPC with an explicit shipping fee and paid state.
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
  shipping_amount numeric,
  shipping_paid boolean,
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
    coalesce(ship.shipping_amount, 0::numeric),
    (c.payment_status = 'paid' and coalesce(ship.shipping_amount, 0) > 0),
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
    select coalesce(sum(
      coalesce(nullif(i.value->>'shipping_fee', '')::numeric, 0)
      * greatest(coalesce(nullif(i.value->>'quantity', '')::integer, 1), 1)
    ), 0)::numeric as shipping_amount
    from jsonb_array_elements(case when jsonb_typeof(c.items) = 'array' then c.items else '[]'::jsonb end) i(value)
  ) ship on true
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
  'Public tracking lookup by unguessable TSB code; returns customer display name, items and payment/shipping summary only.';
