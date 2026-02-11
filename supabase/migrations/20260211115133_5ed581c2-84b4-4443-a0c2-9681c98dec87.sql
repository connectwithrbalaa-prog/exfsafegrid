
-- Create hazard_reports table
CREATE TABLE public.hazard_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT,
  hazard_type TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  submitted_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  review_due_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days')
);

-- Enable RLS
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert and read (agents aren't auth-gated in this app)
CREATE POLICY "Anyone can insert hazard reports"
  ON public.hazard_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read hazard reports"
  ON public.hazard_reports FOR SELECT
  USING (true);

-- Storage bucket for hazard photos
INSERT INTO storage.buckets (id, name, public) VALUES ('hazard-photos', 'hazard-photos', true);

CREATE POLICY "Anyone can upload hazard photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'hazard-photos');

CREATE POLICY "Anyone can view hazard photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hazard-photos');
