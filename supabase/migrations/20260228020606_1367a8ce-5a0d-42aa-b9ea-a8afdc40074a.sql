
-- Create patrol task status enum
CREATE TYPE public.patrol_task_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- Create patrol_tasks table
CREATE TABLE public.patrol_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patrol_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT,
  lat NUMERIC,
  lon NUMERIC,
  status patrol_task_status NOT NULL DEFAULT 'NOT_STARTED',
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 4),
  circuit_id TEXT,
  assigned_crew_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patrol_tasks ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (demo mode)
CREATE POLICY "Anyone can read patrol tasks" ON public.patrol_tasks
  FOR SELECT USING (true);

-- Allow anyone to update status (demo mode)
CREATE POLICY "Anyone can update patrol tasks" ON public.patrol_tasks
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow anyone to insert patrol tasks
CREATE POLICY "Anyone can insert patrol tasks" ON public.patrol_tasks
  FOR INSERT WITH CHECK (true);

-- Seed demo patrol tasks
INSERT INTO public.patrol_tasks (patrol_id, title, description, lat, lon, status, priority, circuit_id) VALUES
  ('PATROL-2026-02-28-001', 'Inspect pole span 23–30', 'Check for vegetation within 10 ft of conductors', 37.3861, -122.0839, 'NOT_STARTED', 1, 'CKT-12A'),
  ('PATROL-2026-02-28-001', 'Verify recloser operation', 'Test ground fault indicators on recloser R-44', 37.3872, -122.0812, 'NOT_STARTED', 1, 'CKT-12A'),
  ('PATROL-2026-02-28-001', 'Clear vegetation segment 4–6', 'Remove deadwood and trim branches near conductors', 37.3845, -122.0855, 'NOT_STARTED', 2, 'CKT-12A'),
  ('PATROL-2026-02-28-001', 'Check tower base erosion', 'Inspect Tower T-19 foundation for erosion damage', 37.3830, -122.0870, 'NOT_STARTED', 2, 'CKT-12A'),
  ('PATROL-2026-02-28-001', 'Photo document insulator condition', 'Pre/post condition photos of insulators span 15–20', 37.3855, -122.0828, 'NOT_STARTED', 3, 'CKT-12A'),
  ('PATROL-2026-02-28-001', 'Verify warning signs in place', 'Ensure danger signs posted at access points', 37.3840, -122.0845, 'NOT_STARTED', 3, 'CKT-12A'),
  ('PATROL-2026-02-28-001', 'Check access road condition', 'Ensure vehicle access is clear to all spans', 37.3820, -122.0860, 'NOT_STARTED', 3, 'CKT-12A'),
  ('PATROL-2026-02-28-001', 'Gate and fence inspection', 'Verify all access points are secure', 37.3815, -122.0875, 'NOT_STARTED', 4, 'CKT-12A'),
  ('PATROL-2026-02-28-002', 'Inspect conductor clearance seg 1–5', 'Minimum 4ft clearance from vegetation', 37.4010, -122.1100, 'NOT_STARTED', 1, 'CKT-07B'),
  ('PATROL-2026-02-28-002', 'Vegetation encroachment survey', 'Trees within 10ft of conductors', 37.4025, -122.1085, 'NOT_STARTED', 2, 'CKT-07B'),
  ('PATROL-2026-02-28-002', 'Equipment condition check', 'Inspect transformer and switches', 37.4040, -122.1070, 'NOT_STARTED', 2, 'CKT-07B'),
  ('PATROL-2026-02-28-002', 'Road hazard assessment', 'Check for road obstructions on patrol route', 37.4055, -122.1055, 'NOT_STARTED', 3, 'CKT-07B');
