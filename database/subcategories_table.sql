-- Create subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, category_id)
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subcategories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER subcategories_updated_at
BEFORE UPDATE ON subcategories
FOR EACH ROW
EXECUTE FUNCTION update_subcategories_updated_at();

-- Add RLS policies
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

-- Allow public read access to subcategories
CREATE POLICY "Allow public read access to subcategories"
ON subcategories FOR SELECT
TO public
USING (true);

-- Allow admins to insert subcategories
CREATE POLICY "Admins can insert subcategories"
ON subcategories FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  )
);

-- Allow admins to update subcategories
CREATE POLICY "Admins can update subcategories"
ON subcategories FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  )
);

-- Allow admins to delete subcategories
CREATE POLICY "Admins can delete subcategories"
ON subcategories FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  )
);

-- Insert some sample subcategories (optional)
INSERT INTO subcategories (name, category_id, description) VALUES 
  ('Smartphones', (SELECT id FROM categories WHERE name = 'Electronics' LIMIT 1), 'Mobile phones and smartphones'),
  ('Laptops', (SELECT id FROM categories WHERE name = 'Electronics' LIMIT 1), 'Portable computers and laptops'),
  ('Men\'s Clothing', (SELECT id FROM categories WHERE name = 'Clothing' LIMIT 1), 'Clothing for men'),
  ('Women\'s Clothing', (SELECT id FROM categories WHERE name = 'Clothing' LIMIT 1), 'Clothing for women'),
  ('Kitchen', (SELECT id FROM categories WHERE name = 'Home & Garden' LIMIT 1), 'Kitchen appliances and tools'),
  ('Garden Tools', (SELECT id FROM categories WHERE name = 'Home & Garden' LIMIT 1), 'Gardening equipment and supplies')
ON CONFLICT (name, category_id) DO NOTHING;
