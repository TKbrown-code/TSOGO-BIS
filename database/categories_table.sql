-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION update_categories_updated_at();

-- Add RLS policies
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access to categories
CREATE POLICY "Allow public read access to categories"
ON categories FOR SELECT
TO public
USING (true);

-- Allow admins to insert categories
CREATE POLICY "Admins can insert categories"
ON categories FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  )
);

-- Allow admins to update categories
CREATE POLICY "Admins can update categories"
ON categories FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  )
);

-- Allow admins to delete categories
CREATE POLICY "Admins can delete categories"
ON categories FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  )
);

-- Insert default categories
INSERT INTO categories (name, description) VALUES 
  ('Electronics', 'Electronic devices and accessories'),
  ('Clothing', 'Fashion and apparel'),
  ('Home & Garden', 'Home decoration and garden supplies'),
  ('Sports', 'Sports equipment and accessories'),
  ('Books', 'Books and educational materials'),
  ('Toys', 'Toys and games'),
  ('Beauty', 'Beauty and personal care products'),
  ('Automotive', 'Car parts and accessories')
ON CONFLICT (name) DO NOTHING;
