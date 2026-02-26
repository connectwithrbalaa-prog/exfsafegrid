
CREATE TABLE public.customer_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  type TEXT NOT NULL DEFAULT 'watch',
  channel TEXT NOT NULL DEFAULT 'sms',
  status TEXT NOT NULL DEFAULT 'sent',
  message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read customer notifications"
  ON public.customer_notifications FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert customer notifications"
  ON public.customer_notifications FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_customer_notifications_customer_id ON public.customer_notifications(customer_id);
CREATE INDEX idx_customer_notifications_sent_at ON public.customer_notifications(sent_at DESC);
