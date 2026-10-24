-- create-account needs only the referrer's id to save referral attribution.
grant select (user_id) on table public.profiles to service_role;
