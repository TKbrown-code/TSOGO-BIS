-- Referral rewards are non-withdrawable store credit. Debit them atomically
-- when a customer checks out, and return the debit if online payment fails.
alter table public.checkouts
  add column if not exists referral_credit_applied numeric(12,2),
  add column if not exists amount_due numeric(12,2);

-- Existing checkouts predate store credit and must retain their original due.
update public.checkouts
set referral_credit_applied = 0,
    amount_due = total
where referral_credit_applied is null or amount_due is null;

-- Keep these columns nullable for newly created checkouts; NULL signals that
-- the server-side atomic credit calculation has not run yet.
alter table public.checkouts
  alter column referral_credit_applied drop default,
  alter column amount_due drop default;

create table if not exists public.referral_wallet_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  entry_type text not null check (entry_type in ('earned', 'spent', 'refund')),
  amount numeric(12,2) not null check (amount > 0),
  referral_id uuid references public.referrals(id) on delete restrict,
  checkout_id bigint references public.checkouts(checkout_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint referral_wallet_entry_origin check (
    (entry_type = 'earned' and referral_id is not null and checkout_id is null)
    or (entry_type in ('spent', 'refund') and referral_id is null and checkout_id is not null)
  )
);
create unique index if not exists referral_wallet_earned_once_uidx
  on public.referral_wallet_ledger(referral_id) where entry_type = 'earned';
create unique index if not exists referral_wallet_checkout_debit_once_uidx
  on public.referral_wallet_ledger(checkout_id) where entry_type = 'spent';
create unique index if not exists referral_wallet_checkout_refund_once_uidx
  on public.referral_wallet_ledger(checkout_id) where entry_type = 'refund';
create index if not exists referral_wallet_user_created_idx
  on public.referral_wallet_ledger(user_id, created_at desc);

alter table public.referral_wallet_ledger enable row level security;
revoke all on public.referral_wallet_ledger from public, anon, authenticated;
grant select (user_id, entry_type, amount) on public.referral_wallet_ledger to authenticated;
grant all on public.referral_wallet_ledger to service_role;
drop policy if exists "users read own referral store credit" on public.referral_wallet_ledger;
create policy "users read own referral store credit"
  on public.referral_wallet_ledger for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.award_first_referral_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral public.referrals%rowtype;
  v_first_item jsonb;
  v_unit_price numeric(12,2);
  v_quantity integer;
  v_commission numeric(12,2);
begin
  if new.payment_status is distinct from 'paid' or old.payment_status = 'paid' or new.user_id is null then
    return new;
  end if;

  select * into v_referral
  from public.referrals r
  where r.referred_user_id = new.user_id
  for update;
  if not found or v_referral.commission_checkout_id is not null then
    return new;
  end if;

  v_first_item := case when jsonb_typeof(new.items) = 'array' then new.items -> 0 else null end;
  if v_first_item is null or jsonb_typeof(v_first_item) <> 'object' then
    return new;
  end if;
  begin
    v_unit_price := (v_first_item ->> 'price')::numeric;
    v_quantity := coalesce((v_first_item ->> 'quantity')::integer, 1);
  exception when invalid_text_representation or numeric_value_out_of_range then
    return new;
  end;
  if v_unit_price is null or v_unit_price <= 0 or v_quantity < 1 then
    return new;
  end if;

  v_commission := round(v_unit_price * v_quantity * 0.03, 2);
  update public.referrals
    set commission_checkout_id = new.checkout_id,
        commission_amount = v_commission,
        commission_status = 'pending',
        commission_created_at = now()
    where id = v_referral.id and commission_checkout_id is null;
  if found and v_commission > 0 then
    insert into public.referral_wallet_ledger(user_id, entry_type, amount, referral_id)
    values (v_referral.referrer_user_id, 'earned', v_commission, v_referral.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.award_first_referral_commission() from public, anon, authenticated;
drop trigger if exists award_first_referral_commission_trigger on public.checkouts;
create trigger award_first_referral_commission_trigger
after update of payment_status on public.checkouts
for each row execute function private.award_first_referral_commission();

create or replace function private.refund_failed_referral_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status in ('failed', 'expired')
    and old.payment_status not in ('failed', 'expired', 'paid')
    and coalesce(new.referral_credit_applied, 0) > 0 then
    insert into public.referral_wallet_ledger(user_id, entry_type, amount, checkout_id)
    values (new.user_id, 'refund', new.referral_credit_applied, new.checkout_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.refund_failed_referral_credit() from public, anon, authenticated;
drop trigger if exists refund_failed_referral_credit_trigger on public.checkouts;
create trigger refund_failed_referral_credit_trigger
after update of payment_status on public.checkouts
for each row execute function private.refund_failed_referral_credit();

create or replace function public.apply_referral_store_credit(
  p_checkout_id bigint,
  p_user_id uuid,
  p_use_credit boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout public.checkouts%rowtype;
  v_balance numeric(12,2);
  v_credit numeric(12,2) := 0;
  v_due numeric(12,2);
begin
  if p_checkout_id is null or p_user_id is null then
    raise exception using errcode = '22023', message = 'Invalid checkout';
  end if;
  -- Serialize wallet debits across simultaneous checkouts for this customer.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('referral-wallet:' || p_user_id::text, 0)
  );
  select * into v_checkout from public.checkouts
  where checkout_id = p_checkout_id and user_id = p_user_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Checkout not found'; end if;

  if v_checkout.referral_credit_applied is not null then
    return jsonb_build_object('amount_due', coalesce(v_checkout.amount_due, v_checkout.total),
      'referral_credit_applied', v_checkout.referral_credit_applied,
      'payment_status', v_checkout.payment_status);
  end if;

  -- A checkout with an already-created provider transaction cannot be repriced.
  if v_checkout.payment_status <> 'initiating'
    or v_checkout.payment_url is not null or v_checkout.payment_reference is not null then
    update public.checkouts set referral_credit_applied = 0, amount_due = total
      where checkout_id = p_checkout_id;
    return jsonb_build_object('amount_due', v_checkout.total,
      'referral_credit_applied', 0, 'payment_status', v_checkout.payment_status);
  end if;

  if p_use_credit then
    select coalesce(sum(case when entry_type = 'spent' then -amount else amount end), 0)::numeric(12,2)
      into v_balance
    from public.referral_wallet_ledger where user_id = p_user_id;
    v_credit := least(greatest(v_balance, 0), v_checkout.total);
  end if;
  v_due := greatest(v_checkout.total - v_credit, 0);

  if v_credit > 0 then
    insert into public.referral_wallet_ledger(user_id, entry_type, amount, checkout_id)
    values (p_user_id, 'spent', v_credit, p_checkout_id);
  end if;

  update public.checkouts set
    referral_credit_applied = v_credit,
    amount_due = v_due,
    payment_method = case when v_due = 0 then 'referral_credit' else payment_method end,
    payment_status = case when v_due = 0 then 'paid' else payment_status end,
    status = case when v_due = 0 then 'paid' else status end,
    inventory_reserved = case when v_due = 0 then false else inventory_reserved end
  where checkout_id = p_checkout_id;

  return jsonb_build_object('amount_due', v_due, 'referral_credit_applied', v_credit,
    'payment_status', case when v_due = 0 then 'paid' else v_checkout.payment_status end);
end;
$$;
revoke all on function public.apply_referral_store_credit(bigint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.apply_referral_store_credit(bigint, uuid, boolean) to service_role;

-- The checkout sync trigger writes the ordinary payment fields for all paid
-- orders. Correct the accounting labels after it runs when store credit paid
-- the full amount, and record only the actual cash due for mixed payments.
create or replace function private.finalize_referral_credit_payment_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'paid' and coalesce(new.referral_credit_applied, 0) >= new.total then
    update public.checkouts set payment_method = 'Referral Store Credit'
    where checkout_id = new.checkout_id;
    delete from public.payment_attempts
    where idempotency_key = coalesce(new.idempotency_key, 'legacy-checkout-' || new.checkout_id::text);
  elsif new.payment_status = 'paid' and coalesce(new.referral_credit_applied, 0) > 0 then
    update public.payment_attempts
      set amount = coalesce(new.amount_due, amount),
          provider_payload = coalesce(provider_payload, '{}'::jsonb)
            || jsonb_build_object('store_credit_applied', new.referral_credit_applied)
    where idempotency_key = coalesce(new.idempotency_key, 'legacy-checkout-' || new.checkout_id::text);
  end if;
  return new;
end;
$$;
revoke all on function private.finalize_referral_credit_payment_record() from public, anon, authenticated;
drop trigger if exists zz_finalize_referral_credit_payment_record on public.checkouts;
create trigger zz_finalize_referral_credit_payment_record
after update of payment_status on public.checkouts
for each row execute function private.finalize_referral_credit_payment_record();

comment on table public.referral_wallet_ledger is
  'Append-only customer store credit earned from referrals and spent only on platform checkouts; no withdrawal path is provided.';
