-- TSOGO-BIS preview catalog: 12 demo products with direct Unsplash image URLs.
-- Safe to rerun: product slugs and image storage_path values are upserted.
-- Run after supabase/schema-v2.sql. Prices are illustrative FCFA amounts.
-- Images are served by URL; this seed does not upload or copy image files.

begin;

insert into public.products
  (slug, name, description, price, currency, stock_quantity, status, published_at)
values
  ('everyday-ceramic-mug', 'Everyday Ceramic Mug', 'A balanced ceramic mug for slow mornings and everyday coffee.', 4500, 'XAF', 24, 'published', now()),
  ('studio-wireless-headphones', 'Studio Wireless Headphones', 'Comfortable over-ear headphones with a clean, considered finish.', 38500, 'XAF', 12, 'published', now()),
  ('weekender-canvas-backpack', 'Weekender Canvas Backpack', 'A sturdy canvas carryall with room for daily essentials and short trips.', 24900, 'XAF', 15, 'published', now()),
  ('minimal-dial-watch', 'Minimal Dial Watch', 'A simple everyday timepiece with a refined, easy-to-pair design.', 32500, 'XAF', 9, 'published', now()),
  ('portable-bluetooth-speaker', 'Portable Bluetooth Speaker', 'Compact wireless sound for a desk, a room, or a weekend away.', 27900, 'XAF', 18, 'published', now()),
  ('city-runner-sneakers', 'City Runner Sneakers', 'Lightweight casual sneakers built for long days on the move.', 42000, 'XAF', 10, 'published', now()),
  ('pocket-film-camera', 'Pocket Film Camera', 'A compact camera for capturing everyday moments with character.', 58900, 'XAF', 6, 'published', now()),
  ('classic-sun-shades', 'Classic Sun Shades', 'A versatile frame with everyday sun protection and timeless lines.', 15900, 'XAF', 20, 'published', now()),
  ('glass-water-bottle', 'Glass Water Bottle', 'A reusable clear glass bottle with a protective sleeve for daily hydration.', 6900, 'XAF', 30, 'published', now()),
  ('warm-glow-table-lamp', 'Warm Glow Table Lamp', 'A soft ambient light for reading corners, bedside tables, and quiet evenings.', 29900, 'XAF', 8, 'published', now()),
  ('daily-care-serum', 'Daily Care Serum', 'A lightweight skincare serum for a simple, comfortable daily routine.', 12500, 'XAF', 14, 'published', now()),
  ('soft-knit-cushion', 'Soft Knit Cushion', 'A textured accent cushion that brings a little warmth to a living space.', 9900, 'XAF', 16, 'published', now())
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  currency = excluded.currency,
  stock_quantity = excluded.stock_quantity,
  status = excluded.status,
  published_at = excluded.published_at;

insert into public.product_images
  (product_id, storage_path, image_url, alt_text, sort_order, is_primary)
select p.id, image.storage_path, image.image_url, image.alt_text, 1, true
from (values
  ('everyday-ceramic-mug', 'seed-preview/everyday-ceramic-mug', 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80', 'White ceramic mug on a table'),
  ('studio-wireless-headphones', 'seed-preview/studio-wireless-headphones', 'https://images.unsplash.com/photo-1613629758552-443027994609?auto=format&fit=crop&w=900&q=80', 'Wireless headphones'),
  ('weekender-canvas-backpack', 'seed-preview/weekender-canvas-backpack', 'https://images.unsplash.com/photo-1622560257067-108402fcedc0?auto=format&fit=crop&w=900&q=80', 'Canvas backpack'),
  ('minimal-dial-watch', 'seed-preview/minimal-dial-watch', 'https://images.unsplash.com/photo-1636737732906-e09674a6d5b8?auto=format&fit=crop&w=900&q=80', 'Minimal wristwatch'),
  ('portable-bluetooth-speaker', 'seed-preview/portable-bluetooth-speaker', 'https://images.unsplash.com/photo-1548617335-c1b176388c65?auto=format&fit=crop&w=900&q=80', 'Portable speaker'),
  ('city-runner-sneakers', 'seed-preview/city-runner-sneakers', 'https://images.unsplash.com/photo-1637437757614-6491c8e915b5?auto=format&fit=crop&w=900&q=80', 'Running shoes'),
  ('pocket-film-camera', 'seed-preview/pocket-film-camera', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80', 'Camera on a neutral background'),
  ('classic-sun-shades', 'seed-preview/classic-sun-shades', 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=80', 'Sunglasses'),
  ('glass-water-bottle', 'seed-preview/glass-water-bottle', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80', 'Reusable water bottle'),
  ('warm-glow-table-lamp', 'seed-preview/warm-glow-table-lamp', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80', 'Table lamp in a calm interior'),
  ('daily-care-serum', 'seed-preview/daily-care-serum', 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80', 'Skincare product bottle'),
  ('soft-knit-cushion', 'seed-preview/soft-knit-cushion', 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=900&q=80', 'Soft decorative cushion')
) as image(slug, storage_path, image_url, alt_text)
join public.products p on p.slug = image.slug
on conflict (storage_path) do update set
  image_url = excluded.image_url,
  alt_text = excluded.alt_text,
  sort_order = excluded.sort_order,
  is_primary = excluded.is_primary;

commit;
