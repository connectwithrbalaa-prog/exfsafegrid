
CREATE TABLE public.risk_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name text NOT NULL,
  band_name text NOT NULL,
  min_probability numeric NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  color_hex text NOT NULL DEFAULT '#6B7280',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(model_name, band_name)
);

-- Enable RLS
ALTER TABLE public.risk_thresholds ENABLE ROW LEVEL SECURITY;

-- Everyone can read thresholds
CREATE POLICY "Anyone can read risk thresholds"
  ON public.risk_thresholds FOR SELECT
  USING (true);

-- Only agents can update
CREATE POLICY "Agents can update risk thresholds"
  ON public.risk_thresholds FOR UPDATE
  USING (public.has_role(auth.uid(), 'agent'))
  WITH CHECK (public.has_role(auth.uid(), 'agent'));

-- Only agents can insert
CREATE POLICY "Agents can insert risk thresholds"
  ON public.risk_thresholds FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'agent'));
