-- Keep catalog browsing available to anonymous visitors. Admin access is
-- provided by the separate admin policies below, not the public read rules.
drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories" on public.categories
  for select to anon, authenticated
  using (is_active);

drop policy if exists "public read published products" on public.products;
create policy "public read published products" on public.products
  for select to anon, authenticated
  using (
    status = 'published'
    and (select c.is_active from public.categories c where c.id = category_id) is distinct from false
  );

drop policy if exists "public read images for published products" on public.product_images;
create policy "public read images for published products" on public.product_images
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.status = 'published'
    )
  );

drop policy if exists "public read tags for published products" on public.product_tags;
create policy "public read tags for published products" on public.product_tags
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.status = 'published'
    )
  );
