-- Pix CANCELADO libera edição e exclusão para usuário comum (e recobrança via workflows)
drop policy if exists emissoes_upd on public.emissoes;
create policy emissoes_upd on public.emissoes for update
using (txid is null or status_pix = 'CANCELADO' or is_delete_admin())
with check (txid is null or status_pix = 'CANCELADO' or is_delete_admin());

drop policy if exists emissoes_del on public.emissoes;
create policy emissoes_del on public.emissoes for delete
using (
  (forma_cobranca is null and pix_txid is null and checkout_id is null and txid is null)
  or status_pix = 'CANCELADO'
  or is_delete_admin()
);
