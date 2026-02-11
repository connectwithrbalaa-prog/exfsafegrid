
CREATE POLICY "Anyone can update customers"
  ON public.customers
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
