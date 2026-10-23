-- Let verified admins review referral activity while keeping customer rows
-- private to their owners. The referral migrations must be applied first.
drop policy if exists "admins read referral activity" on public.referrals;
create policy "admins read referral activity"
  on public.referrals
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "admins read referral wallet activity" on public.referral_wallet_ledger;
create policy "admins read referral wallet activity"
  on public.referral_wallet_ledger
  for select
  to authenticated
  using ((select public.is_admin()));
