-- Create user_roles table for secure role management
-- This prevents privilege escalation by separating roles from user-editable profile data

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only owners can manage roles
CREATE POLICY "Owners can manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migrate existing profile roles to user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Add RLS policies to tax_codes table
-- Only owners can insert, update, or delete tax codes
CREATE POLICY "Only owners can insert tax codes"
  ON public.tax_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Only owners can update tax codes"
  ON public.tax_codes
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Only owners can delete tax codes"
  ON public.tax_codes
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));