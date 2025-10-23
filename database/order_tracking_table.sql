-- Order Tracking Table
-- Stores tracking information for orders

CREATE TABLE IF NOT EXISTS order_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES checkouts(id) ON DELETE CASCADE,
  tracking_number TEXT UNIQUE NOT NULL,
  user_name TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  shipping_from TEXT NOT NULL,
  present_location TEXT NOT NULL,
  status TEXT DEFAULT 'in_transit' CHECK (status IN ('pending', 'in_transit', 'out_for_delivery', 'delivered', 'failed')),
  estimated_delivery DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tracking_number ON order_tracking(tracking_number);
CREATE INDEX IF NOT EXISTS idx_order_id ON order_tracking(order_id);

-- RLS Policies
ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read tracking info with tracking number
CREATE POLICY "Anyone can view tracking with tracking number"
  ON order_tracking FOR SELECT
  USING (true);

-- Only admins can insert/update tracking
CREATE POLICY "Admins can insert tracking"
  ON order_tracking FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update tracking"
  ON order_tracking FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_order_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_order_tracking_timestamp
  BEFORE UPDATE ON order_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_order_tracking_updated_at();
