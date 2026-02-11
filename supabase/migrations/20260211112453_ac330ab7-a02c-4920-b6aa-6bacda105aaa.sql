
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS has_portable_battery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_transfer_meter boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_permanent_battery text NOT NULL DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS current_outage_status text NOT NULL DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS restoration_timer text NOT NULL DEFAULT 'TBD',
  ADD COLUMN IF NOT EXISTS nearest_crc_location text NOT NULL DEFAULT '';
