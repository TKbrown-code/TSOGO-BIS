-- Keep the language selected during checkout with the order so delayed payment
-- confirmations use the customer's checkout language even if their profile
-- preference is stale or changes before payment is completed.
alter table public.checkouts
  add column if not exists email_language text;

update public.checkouts c
set email_language = coalesce(p.preferred_language, 'fr')
from public.profiles p
where p.user_id = c.user_id
  and c.email_language is null;

update public.checkouts
set email_language = 'fr'
where email_language is null or email_language not in ('en', 'fr', 'zh');

alter table public.checkouts
  alter column email_language set default 'fr',
  alter column email_language set not null;

alter table public.checkouts
  drop constraint if exists checkouts_email_language_check;
alter table public.checkouts
  add constraint checkouts_email_language_check
  check (email_language in ('en', 'fr', 'zh'));
