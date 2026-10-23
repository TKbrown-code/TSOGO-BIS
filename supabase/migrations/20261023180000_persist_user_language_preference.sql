-- Persist the user's interface language on their profile for transactional email.
alter table public.profiles
  add column if not exists preferred_language text not null default 'fr';
alter table public.profiles
  alter column preferred_language set default 'fr';

-- Preserve preferences written by the earlier client, if the legacy column exists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'language'
  ) then
    execute $copy$
      update public.profiles
      set preferred_language = language
      where language in ('en', 'fr', 'zh')
    $copy$;
  end if;
end;
$$;

update public.profiles
set preferred_language = 'fr'
where preferred_language not in ('en', 'fr', 'zh');

alter table public.profiles
  drop constraint if exists profiles_preferred_language_check;
alter table public.profiles
  add constraint profiles_preferred_language_check
  check (preferred_language in ('en', 'fr', 'zh'));

-- Carry an explicitly selected guest language through account creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, display_name, preferred_language)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    case when new.raw_user_meta_data ->> 'preferred_language' in ('en', 'fr', 'zh')
      then new.raw_user_meta_data ->> 'preferred_language' else 'fr' end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
