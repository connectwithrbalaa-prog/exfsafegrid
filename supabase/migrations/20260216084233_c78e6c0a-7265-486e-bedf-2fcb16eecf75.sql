
-- Alert subscribers: residents who opt-in to receive notifications
CREATE TABLE public.alert_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  zip_code TEXT NOT NULL,
  preferred_channel TEXT NOT NULL DEFAULT 'email',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read alert subscribers" ON public.alert_subscribers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert alert subscribers" ON public.alert_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update alert subscribers" ON public.alert_subscribers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete alert subscribers" ON public.alert_subscribers FOR DELETE USING (true);

-- Community alerts: log of all alerts sent
CREATE TABLE public.community_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL DEFAULT 'fire_proximity',
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  affected_zips TEXT[] NOT NULL DEFAULT '{}',
  fire_distance_km NUMERIC,
  fire_latitude NUMERIC,
  fire_longitude NUMERIC,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read community alerts" ON public.community_alerts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert community alerts" ON public.community_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update community alerts" ON public.community_alerts FOR UPDATE USING (true) WITH CHECK (true);
