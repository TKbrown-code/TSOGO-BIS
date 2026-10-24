-- Create referral attribution through a narrowly scoped definer function.
-- This repairs profiles missing for older Auth users without granting the
-- Edge Function service role broad write access to the profiles table.
create or replace function public.record_signup_referral(
  p_referrer_user_id uuid,
  p_referred_user_id uuid,
  p_referral_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if p_referrer_user_id is null or p_referred_user_id is null
    or p_referrer_user_id = p_referred_user_id then
    return false;
  end if;

  -- Existing rows are left untouched. The user_id FK validates that the Auth
  -- account exists; all remaining profile fields use their table defaults.
  insert into public.profiles(user_id)
  values (p_referrer_user_id)
  on conflict (user_id) do nothing;

  insert into public.referrals(referrer_user_id, referred_user_id, referral_code)
  values (p_referrer_user_id, p_referred_user_id, p_referral_code)
  on conflict (referred_user_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function public.record_signup_referral(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_signup_referral(uuid, uuid, text) to service_role;
