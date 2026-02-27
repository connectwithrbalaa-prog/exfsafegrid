
CREATE TABLE public.psps_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name TEXT NOT NULL,
  circuit_ids TEXT[] NOT NULL DEFAULT '{}',
  horizon_hours INTEGER NOT NULL DEFAULT 24,
  total_customers INTEGER NOT NULL DEFAULT 0,
  residential INTEGER NOT NULL DEFAULT 0,
  commercial INTEGER NOT NULL DEFAULT 0,
  critical INTEGER NOT NULL DEFAULT 0,
  mw_lost NUMERIC(8,1) NOT NULL DEFAULT 0,
  restoration_hours INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.psps_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read psps scenarios" ON public.psps_scenarios
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert psps scenarios" ON public.psps_scenarios
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete psps scenarios" ON public.psps_scenarios
  FOR DELETE USING (true);
