-- Keep the checkout tables used by the app in sync with the normalized order
-- tables in schema-v2.sql. This trigger is transactional and safe to replay.

alter table public.checkouts
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create unique index if not exists checkouts_order_id_uidx
  on public.checkouts(order_id) where order_id is not null;

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

    new.order_id := v_order_id;
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

  if v_needs_link then
    update public.checkouts set order_id = v_order_id where checkout_id = new.checkout_id and order_id is distinct from v_order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_fapshi_checkout_order_trigger on public.checkouts;
create trigger sync_fapshi_checkout_order_trigger
after insert or update of payment_status, payment_reference, payment_url, payment_provider, order_id
on public.checkouts
for each row execute function public.sync_fapshi_checkout_order();

-- Repair historical checkout rows (including rows created before this migration).
update public.checkouts set payment_status = payment_status
where order_id is null;

revoke all on function public.sync_fapshi_checkout_order() from public, anon, authenticated;
grant execute on function public.sync_fapshi_checkout_order() to service_role;
