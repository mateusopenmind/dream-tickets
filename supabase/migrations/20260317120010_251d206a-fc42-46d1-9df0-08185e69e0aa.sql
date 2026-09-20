
-- Function to check if current user is the admin email
CREATE OR REPLACE FUNCTION public.is_delete_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email') = 'bruno@dreamticketsbr.com'
$$;

-- Update DELETE policies for all tables
DROP POLICY IF EXISTS "Authenticated users can delete clientes" ON public.clientes;
CREATE POLICY "Only admin can delete clientes" ON public.clientes
  FOR DELETE TO authenticated USING (public.is_delete_admin());

DROP POLICY IF EXISTS "Authenticated users can delete contas" ON public.contas;
CREATE POLICY "Only admin can delete contas" ON public.contas
  FOR DELETE TO authenticated USING (public.is_delete_admin());

DROP POLICY IF EXISTS "Authenticated users can delete cartoes" ON public.cartoes;
CREATE POLICY "Only admin can delete cartoes" ON public.cartoes
  FOR DELETE TO authenticated USING (public.is_delete_admin());

DROP POLICY IF EXISTS "Authenticated users can delete emissoes" ON public.emissoes;
CREATE POLICY "Only admin can delete emissoes" ON public.emissoes
  FOR DELETE TO authenticated USING (public.is_delete_admin());
