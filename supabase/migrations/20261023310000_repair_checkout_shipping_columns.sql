-- Repair deployments where checkout functions were updated but the shipping
-- payment columns were not created on public.checkouts.
alter table public.checkouts
  add column if not exists shipping_payment_mode text not null default 'arrival',
  add column if not exists shipping_due_on_delivery numeric(12,2) not null default 0;
