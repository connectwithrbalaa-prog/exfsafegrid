
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'executive';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'field';

-- Update get_user_role to return the role as text
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;
