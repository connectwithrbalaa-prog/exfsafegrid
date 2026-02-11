
-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  zip_code TEXT NOT NULL,
  wildfire_risk TEXT NOT NULL DEFAULT 'Low',
  arrears_status TEXT NOT NULL DEFAULT 'No',
  arrears_amount NUMERIC NOT NULL DEFAULT 0,
  bill_trend TEXT NOT NULL DEFAULT 'Flat',
  grid_stress_level TEXT NOT NULL DEFAULT 'Low',
  outage_history TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS but allow public read (demo app, no auth)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read customers"
  ON public.customers
  FOR SELECT
  USING (true);
