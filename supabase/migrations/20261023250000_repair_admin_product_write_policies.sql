-- Keep catalog writes restricted to authenticated users that pass the same
-- database admin check used by the admin workspace.
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_tags enable row level security;

grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_images to authenticated;
grant select, insert, update, delete on public.product_tags to authenticated;

drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admins manage product images" on public.product_images;
create policy "admins manage product images" on public.product_images
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admins manage product tags" on public.product_tags;
create policy "admins manage product tags" on public.product_tags
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- The products-images bucket is public for reads, while writes stay admin-only.
update storage.buckets
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'products-images';

drop policy if exists "product images insert by admins" on storage.objects;
create policy "product images insert by admins" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'products-images' and (select public.is_admin()));

drop policy if exists "product images update by admins" on storage.objects;
create policy "product images update by admins" on storage.objects
  for update to authenticated
  using (bucket_id = 'products-images' and (select public.is_admin()))
  with check (bucket_id = 'products-images' and (select public.is_admin()));

drop policy if exists "product images delete by admins" on storage.objects;
create policy "product images delete by admins" on storage.objects
  for delete to authenticated
  using (bucket_id = 'products-images' and (select public.is_admin()));
