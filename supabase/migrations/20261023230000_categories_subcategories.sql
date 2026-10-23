-- Add real parent-linked subcategories used by the catalogue and admin product form.
create table if not exists public.subcategories (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.categories(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null check (length(trim(slug)) > 0),
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subcategories_category_slug_uidx unique (category_id, slug)
);

alter table public.products
  add column if not exists subcategory_id bigint references public.subcategories(id) on delete set null;
create index if not exists subcategories_category_sort_idx on public.subcategories(category_id, sort_order, name);
create index if not exists products_subcategory_idx on public.products(subcategory_id);

alter table public.subcategories enable row level security;
drop policy if exists "Public can read active subcategories" on public.subcategories;
create policy "Public can read active subcategories" on public.subcategories
  for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.categories c where c.id = category_id and c.is_active
  ));
drop policy if exists "Admins manage subcategories" on public.subcategories;
create policy "Admins manage subcategories" on public.subcategories
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
grant select on public.subcategories to anon, authenticated;
grant insert, update, delete on public.subcategories to authenticated;
grant usage, select on sequence public.subcategories_id_seq to authenticated;

create or replace function private.validate_product_subcategory_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_id bigint;
begin
  if new.subcategory_id is null then return new; end if;
  select s.category_id into v_category_id
  from public.subcategories s
  where s.id = new.subcategory_id;
  if v_category_id is null then
    raise exception 'Subcategory not found' using errcode = '23503';
  end if;
  if new.category_id is distinct from v_category_id then
    raise exception 'Product category must match the selected subcategory parent' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_product_subcategory_parent() from public, anon, authenticated;
drop trigger if exists validate_product_subcategory_parent_trigger on public.products;
create trigger validate_product_subcategory_parent_trigger
before insert or update of category_id, subcategory_id on public.products
for each row execute function private.validate_product_subcategory_parent();
