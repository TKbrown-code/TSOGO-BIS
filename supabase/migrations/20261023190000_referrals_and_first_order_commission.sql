-- Referral attribution and a one-time 3% commission on a referred customer's
-- first successful paid checkout. Commission is accrued as pending for manual
-- payout; it excludes shipping fees and is based on the first product line.

alter table public.profiles
  add column if not exists referral_code text;

update public.profiles
set referral_code = upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 12))
where referral_code is null;

alter table public.profiles
  alter column referral_code set default upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 12)),
  alter column referral_code set not null;

create unique index if not exists profiles_referral_code_uidx
  on public.profiles(referral_code);

create or replace function private.keep_profile_referral_code_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.referral_code is distinct from old.referral_code then
    raise exception using errcode = '42501', message = 'Referral codes cannot be changed';
  end if;
  return new;
end;
$$;
revoke all on function private.keep_profile_referral_code_immutable() from public, anon, authenticated;
drop trigger if exists keep_profile_referral_code_immutable_trigger on public.profiles;
create trigger keep_profile_referral_code_immutable_trigger
before update of referral_code on public.profiles
for each row execute function private.keep_profile_referral_code_immutable();

create table if not exists public.referrals (
  id uuid primary key default extensions.gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles(user_id) on delete cascade,
  referred_user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  referral_code text not null,
  created_at timestamptz not null default now(),
  commission_checkout_id bigint unique references public.checkouts(checkout_id) on delete set null,
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  commission_status text not null default 'none' check (commission_status in ('none', 'pending', 'paid')),
  commission_created_at timestamptz,
  constraint referrals_no_self_referral check (referrer_user_id <> referred_user_id)
);

create index if not exists referrals_referrer_created_idx
  on public.referrals(referrer_user_id, created_at desc);
alter table public.referrals enable row level security;
revoke all on public.referrals from public, anon, authenticated;
-- The customer dashboard needs aggregate inputs only. Keep the referred
-- account id and checkout id private from the referrer-facing Data API.
grant select (id, referrer_user_id, created_at, commission_amount, commission_status)
  on public.referrals to authenticated;
grant all on public.referrals to service_role;
drop policy if exists "referrers read their referral summary" on public.referrals;
create policy "referrers read their referral summary"
  on public.referrals for select to authenticated
  using (referrer_user_id = (select auth.uid()));

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

  v_first_item := case
    when jsonb_typeof(new.items) = 'array' then new.items -> 0
    else null
  end;
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
    where id = v_referral.id
      and commission_checkout_id is null;
  return new;
end;
$$;
revoke all on function private.award_first_referral_commission() from public, anon, authenticated;
drop trigger if exists award_first_referral_commission_trigger on public.checkouts;
create trigger award_first_referral_commission_trigger
after update of payment_status on public.checkouts
for each row execute function private.award_first_referral_commission();

comment on table public.referrals is
  'Signup referral attribution. Commission is awarded once, on the first paid checkout, at 3% of its first product line excluding shipping. Pending amounts are payable by admin out of band.';
