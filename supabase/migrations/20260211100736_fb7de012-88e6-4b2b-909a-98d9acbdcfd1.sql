
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS agent_notes TEXT DEFAULT '';
