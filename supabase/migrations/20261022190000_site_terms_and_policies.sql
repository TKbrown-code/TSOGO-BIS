alter table public.site_settings
  add column if not exists terms_and_policies text not null default $$DRAFT TERMS AND POLICIES — replace this text before launch.

1. Accounts: Keep your account information accurate and protect your sign-in credentials.
2. Products and prices: Product descriptions, availability, and prices may change. Prices and payment totals are shown before an order is placed.
3. Orders and payment: An order is submitted when checkout is completed. Payment must be confirmed before fulfillment begins.
4. Delivery: Delivery estimates are approximate and may change due to location, carrier, or customs delays.
5. Returns and support: Contact TSOGO-BIS support with your order details if an item arrives damaged or an order needs attention. Return eligibility will be confirmed by support.
6. Privacy: Account and order information is used to provide store services and support. Do not submit information that is not needed to complete your order.
7. Updates: These terms may be revised. The current version will be published on this page.$$;

alter table public.site_settings
  alter column terms_and_policies set default $$DRAFT TERMS AND POLICIES — replace this text before launch.

1. Accounts: Keep your account information accurate and protect your sign-in credentials.
2. Products and prices: Product descriptions, availability, and prices may change. Prices and payment totals are shown before an order is placed.
3. Orders and payment: An order is submitted when checkout is completed. Payment must be confirmed before fulfillment begins.
4. Delivery: Delivery estimates are approximate and may change due to location, carrier, or customs delays.
5. Returns and support: Contact TSOGO-BIS support with your order details if an item arrives damaged or an order needs attention. Return eligibility will be confirmed by support.
6. Privacy: Account and order information is used to provide store services and support. Do not submit information that is not needed to complete your order.
7. Updates: These terms may be revised. The current version will be published on this page.$$;

insert into public.site_settings (id)
values (true)
on conflict (id) do nothing;
