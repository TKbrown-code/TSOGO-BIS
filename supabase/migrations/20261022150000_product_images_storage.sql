-- Product images are public storefront assets. Public buckets bypass RLS for
-- downloads, while every write remains guarded by storage.objects policies.
update storage.buckets
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'products-images';

drop policy if exists "product images insert by admins" on storage.objects;
create policy "product images insert by admins"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'products-images'
  and (select public.is_admin())
);

drop policy if exists "product images update by admins" on storage.objects;
create policy "product images update by admins"
on storage.objects for update to authenticated
using (
  bucket_id = 'products-images'
  and (select public.is_admin())
)
with check (
  bucket_id = 'products-images'
  and (select public.is_admin())
);

drop policy if exists "product images delete by admins" on storage.objects;
create policy "product images delete by admins"
on storage.objects for delete to authenticated
using (
  bucket_id = 'products-images'
  and (select public.is_admin())
);
