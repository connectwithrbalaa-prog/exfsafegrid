
-- Add region, HFTD tier, and medical baseline columns
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'Bay Area',
  ADD COLUMN IF NOT EXISTS hftd_tier text NOT NULL DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS medical_baseline boolean NOT NULL DEFAULT false;
