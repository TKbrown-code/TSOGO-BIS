-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT NOT NULL DEFAULT 'TSOGO-BIS',
  site_email TEXT,
  site_phone TEXT,
  currency TEXT NOT NULL DEFAULT 'XAF',
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings (only one row should exist)
INSERT INTO site_settings (site_name, site_email, site_phone, currency, tax_rate)
VALUES ('TSOGO-BIS', 'admin@tsogo-bis.com', '+237 XXX XXX XXX', 'XAF', 0.00)
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER site_settings_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW
EXECUTE FUNCTION update_site_settings_updated_at();

-- Add RLS policies (allow admins to read/update)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read site settings
CREATE POLICY "Allow public read access to site_settings"
ON site_settings FOR SELECT
TO public
USING (true);

-- Allow authenticated users to update (you can restrict this to admins only if needed)
CREATE POLICY "Allow authenticated users to update site_settings"
ON site_settings FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
