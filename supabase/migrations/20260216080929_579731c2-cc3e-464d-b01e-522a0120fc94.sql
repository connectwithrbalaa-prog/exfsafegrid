
-- HVRA Asset Registry: categorized high-value resources with weighted importance
CREATE TABLE public.hvra_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'Substation', 'School', 'Hospital', 'Timber', 'Water', 'Cultural', 'Residential'
  subcategory TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  importance_weight NUMERIC NOT NULL DEFAULT 1.0,  -- 0-10 scale
  response_function TEXT NOT NULL DEFAULT 'susceptible', -- 'susceptible', 'adaptable', 'resistant'
  value_estimate NUMERIC DEFAULT 0,
  population_served INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hvra_assets ENABLE ROW LEVEL SECURITY;

-- Public read access for all users
CREATE POLICY "Anyone can read HVRA assets"
  ON public.hvra_assets FOR SELECT USING (true);

-- Public insert for agents
CREATE POLICY "Anyone can insert HVRA assets"
  ON public.hvra_assets FOR INSERT WITH CHECK (true);

-- Public update for agents
CREATE POLICY "Anyone can update HVRA assets"
  ON public.hvra_assets FOR UPDATE USING (true) WITH CHECK (true);

-- Public delete for agents
CREATE POLICY "Anyone can delete HVRA assets"
  ON public.hvra_assets FOR DELETE USING (true);

-- Seed initial HVRA data from existing substations + nearby community assets
INSERT INTO public.hvra_assets (name, category, subcategory, latitude, longitude, importance_weight, response_function, value_estimate, population_served, notes) VALUES
  ('North Substation', 'Substation', '220kV', 37.25, -119.28, 9.0, 'susceptible', 45000000, 12000, 'Zone A — North Highlands. Critical grid node.'),
  ('Valley Substation', 'Substation', '110kV', 37.18, -119.35, 7.5, 'susceptible', 28000000, 8500, 'Zone B — Valley Central.'),
  ('South Ridge Substation', 'Substation', '110kV', 37.12, -119.40, 8.0, 'susceptible', 32000000, 9200, 'Zone C — South Ridge. Currently at reduced capacity.'),
  ('Foothill Substation', 'Substation', '66kV', 37.30, -119.22, 6.0, 'susceptible', 15000000, 4800, 'Zone D — Foothill East.'),
  ('Sierra Vista Hospital', 'Hospital', 'Regional Medical Center', 37.22, -119.32, 10.0, 'susceptible', 85000000, 35000, 'Level III trauma center. Evacuation priority.'),
  ('Madera South High School', 'School', 'High School', 37.19, -119.34, 7.0, 'adaptable', 12000000, 1800, 'Designated community shelter during PSPS events.'),
  ('Pine Ridge Elementary', 'School', 'Elementary', 37.26, -119.27, 7.5, 'adaptable', 8000000, 650, 'Located in HFTD Tier 2 zone.'),
  ('Bass Lake Water Treatment', 'Water', 'Treatment Plant', 37.32, -119.23, 8.5, 'resistant', 22000000, 15000, 'Primary water supply for northern communities.'),
  ('Sierra National Forest — South', 'Timber', 'Mixed Conifer', 37.15, -119.42, 5.0, 'susceptible', 0, 0, 'High fuel load. Fire history: 2020, 2022.'),
  ('Ahwahnee Cultural Site', 'Cultural', 'Heritage', 37.28, -119.26, 6.5, 'susceptible', 0, 0, 'Protected heritage site. No fire suppression infrastructure.');
