-- Keep wallet history when its source checkout is intentionally purged.
alter table public.referral_wallet_ledger
  drop constraint if exists referral_wallet_entry_origin;
alter table public.referral_wallet_ledger
  add constraint referral_wallet_entry_origin check (
    (entry_type = 'earned' and referral_id is not null and checkout_id is null)
    or (entry_type in ('spent', 'refund') and referral_id is null)
  );

create or replace function public.admin_delete_orders_by_group(p_group text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout_ids bigint[];
  v_order_ids uuid[];
  v_deleted_count bigint;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_group not in ('awaiting_payment', 'failed', 'cancelled', 'paid', 'refunded', 'other') then
    raise exception 'Unsupported order group' using errcode = '22023';
  end if;

  select coalesce(array_agg(grouped.checkout_id), array[]::bigint[]),
         coalesce(array_agg(grouped.order_id) filter (where grouped.order_id is not null), array[]::uuid[])
    into v_checkout_ids, v_order_ids
  from (
    select checkout_id, order_id,
      case
        when lower(coalesce(payment_status, '')) in ('paid', 'succeeded', 'successful', 'completed')
          or lower(coalesce(status, '')) in ('paid', 'succeeded', 'successful', 'completed', 'confirmed') then 'paid'
        when lower(coalesce(payment_status, '')) in ('failed', 'expired')
          or lower(coalesce(status, '')) in ('failed', 'expired') then 'failed'
        when lower(coalesce(payment_status, '')) = 'refunded'
          or lower(coalesce(status, '')) = 'refunded' then 'refunded'
        when lower(coalesce(payment_status, '')) = 'cancelled'
          or lower(coalesce(status, '')) = 'cancelled' then 'cancelled'
        when lower(coalesce(payment_status, '')) in ('pending', 'pending_payment', 'awaiting_payment', 'initiating', 'processing')
          or lower(coalesce(status, '')) in ('pending', 'pending_payment', 'awaiting_payment', 'initiating') then 'awaiting_payment'
        else 'other'
      end as payment_group
    from public.checkouts
  ) as grouped
  where grouped.payment_group = p_group;

  if cardinality(v_checkout_ids) = 0 then
    return 0;
  end if;

  delete from public.shipment_events event
  using public.shipments shipment
  where event.shipment_id = shipment.id
    and shipment.order_id = any(v_order_ids);
  delete from public.shipments where order_id = any(v_order_ids);
  delete from public.payment_attempts where order_id = any(v_order_ids);

  update public.referral_wallet_ledger
    set checkout_id = null
    where checkout_id = any(v_checkout_ids);

  delete from public.checkouts where checkout_id = any(v_checkout_ids);
  get diagnostics v_deleted_count = row_count;
  delete from public.orders where id = any(v_order_ids);
  return v_deleted_count;
end;
$$;

revoke all on function public.admin_delete_orders_by_group(text) from public, anon;
grant execute on function public.admin_delete_orders_by_group(text) to authenticated;
