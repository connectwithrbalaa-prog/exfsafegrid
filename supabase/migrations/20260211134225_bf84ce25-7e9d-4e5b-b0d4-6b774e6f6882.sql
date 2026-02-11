
-- Table for customer quick-link submissions (outage reports, bill inquiries, assistance apps, demand response)
CREATE TABLE public.customer_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  request_type TEXT NOT NULL, -- 'outage_report' | 'bill_inquiry' | 'assistance_application' | 'demand_response'
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  agent_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (customers submit requests)
CREATE POLICY "Anyone can insert customer requests"
ON public.customer_requests
FOR INSERT
WITH CHECK (true);

-- Anyone can read (agents need to see all)
CREATE POLICY "Anyone can read customer requests"
ON public.customer_requests
FOR SELECT
USING (true);

-- Anyone can update (agents respond)
CREATE POLICY "Anyone can update customer requests"
ON public.customer_requests
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_requests;
