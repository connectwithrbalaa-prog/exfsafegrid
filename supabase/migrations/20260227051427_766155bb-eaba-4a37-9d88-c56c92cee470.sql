
-- Playbooks table
CREATE TABLE public.psps_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  circuit_ids TEXT[] NOT NULL DEFAULT '{}',
  baseline_metrics JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- RLS
ALTER TABLE public.psps_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read playbooks" ON public.psps_playbooks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert playbooks" ON public.psps_playbooks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update playbooks" ON public.psps_playbooks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete playbooks" ON public.psps_playbooks FOR DELETE USING (true);

-- PSPS events table for historical replay
CREATE TABLE public.psps_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  circuit_ids TEXT[] NOT NULL DEFAULT '{}',
  horizon_hours INTEGER NOT NULL DEFAULT 24,
  total_customers INTEGER NOT NULL DEFAULT 0,
  residential INTEGER NOT NULL DEFAULT 0,
  commercial INTEGER NOT NULL DEFAULT 0,
  critical INTEGER NOT NULL DEFAULT 0,
  mw_lost NUMERIC NOT NULL DEFAULT 0,
  restoration_hours INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.psps_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read psps events" ON public.psps_events FOR SELECT USING (true);
CREATE POLICY "Anyone can insert psps events" ON public.psps_events FOR INSERT WITH CHECK (true);

-- Seed some historical events
INSERT INTO public.psps_events (event_name, event_date, circuit_ids, horizon_hours, total_customers, residential, commercial, critical, mw_lost, restoration_hours, summary)
VALUES
  ('October Wind Event 2024', '2024-10-15', ARRAY['SCE-001','SCE-002','PGE-002'], 48, 14600, 11388, 2628, 203, 73.0, 36, 'Major Santa Ana wind event affecting SCE and PG&E service territories across 3 circuits.'),
  ('Diablo Wind Shutoff Nov 2024', '2024-11-03', ARRAY['PGE-001','PGE-004','PGE-006'], 24, 23800, 18564, 4284, 312, 119.0, 22, 'Precautionary Diablo wind shutoff across Bay Area and Wine Country corridors.'),
  ('Holiday Heat Event Dec 2024', '2024-12-22', ARRAY['SDGE-001','SDGE-003','SCE-005'], 72, 13000, 10140, 2340, 165, 65.0, 52, 'Unseasonal Santa Ana conditions during holiday period impacting San Diego and LA regions.'),
  ('Spring Red Flag Apr 2025', '2025-04-08', ARRAY['PGE-003','PGE-005','PGE-008'], 24, 5800, 4524, 1044, 113, 29.0, 18, 'Early-season red flag warning affecting Sierra foothills communities.'),
  ('Summer Fire Weather Jul 2025', '2025-07-20', ARRAY['SCE-001','SCE-003','SCE-006','SDGE-002','SDGE-004'], 48, 15350, 11973, 2763, 207, 76.8, 42, 'Widespread extreme fire weather across Southern California requiring multi-utility PSPS.');
