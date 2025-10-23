-- Add subcategory_id column to products table
-- Run this SQL in your Supabase SQL Editor

-- Add the subcategory_id column (nullable, since not all products need subcategories)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS subcategory_id bigint;

-- Add foreign key constraint to subcategories table
ALTER TABLE public.products
ADD CONSTRAINT products_subcategory_fkey 
FOREIGN KEY (subcategory_id) 
REFERENCES public.subcategories(id) 
ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id 
ON public.products USING btree (subcategory_id);

-- Optional: Add a comment to document the column
COMMENT ON COLUMN public.products.subcategory_id IS 'Optional subcategory for more specific product classification';
