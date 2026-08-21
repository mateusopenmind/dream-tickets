-- Usuário comum pode excluir emissões SEM cobrança gerada; com cobrança, só delete-admin.
drop policy if exists emissoes_del on public.emissoes;
create policy emissoes_del on public.emissoes for delete
using (
  (forma_cobranca is null and pix_txid is null and checkout_id is null and txid is null)
  or is_delete_admin()
);
