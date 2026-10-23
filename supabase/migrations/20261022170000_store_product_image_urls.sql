-- Store the public render URL alongside the internal Storage path.
alter table public.product_images add column if not exists image_url text;

update public.product_images
set image_url = 'https://bompysyuamyalbzmubzo.supabase.co/storage/v1/object/public/products-images/' || storage_path
where image_url is null;

alter table public.product_images alter column image_url set not null;
