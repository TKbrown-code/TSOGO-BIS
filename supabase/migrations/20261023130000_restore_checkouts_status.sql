-- Restore the checkout lifecycle column accidentally removed from the table.
alter table public.checkouts
  add column if not exists status text not null default 'pending';

-- Reconcile existing rows without overwriting other application-specific states.
update public.checkouts
set status = case
  when payment_status = 'paid' then 'paid'
  when payment_status in ('failed', 'expired') then 'cancelled'
  when status is null or status = '' then 'pending'
  else status
end;
