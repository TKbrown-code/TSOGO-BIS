alter table public.coupons
  add column if not exists category_id bigint references public.categories(id) on delete cascade,
  add column if not exists subcategory_id bigint references public.subcategories(id) on delete cascade;

alter table public.coupons drop constraint if exists coupons_single_scope;
alter table public.coupons add constraint coupons_single_scope
  check (num_nonnulls(product_id, category_id, subcategory_id) <= 1);

create index if not exists coupons_category_scope_idx on public.coupons(category_id) where category_id is not null;
create index if not exists coupons_subcategory_scope_idx on public.coupons(subcategory_id) where subcategory_id is not null;

create index if not exists coupons_product_scope_idx on public.coupons(product_id) where product_id is not null;
