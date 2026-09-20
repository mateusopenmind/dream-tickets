
-- Update policy: prevent editing emissoes when txid is set
DROP POLICY IF EXISTS "Authenticated users can update emissoes" ON public.emissoes;

CREATE POLICY "Authenticated users can update emissoes" ON public.emissoes
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    -- Allow if txid was previously null, OR if it's the same row being updated without changing restricted fields
    (SELECT e.txid IS NULL FROM public.emissoes e WHERE e.id = id)
    OR
    -- Allow admin to bypass
    public.is_delete_admin()
  );
