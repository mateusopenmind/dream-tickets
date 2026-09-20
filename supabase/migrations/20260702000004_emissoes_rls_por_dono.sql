-- Usuário comum: só as próprias emissões (owner_id = auth.uid()). Admin/super_admin/delete-admin: tudo.
drop policy if exists emissoes_sel on public.emissoes;
create policy emissoes_sel on public.emissoes for select
using (owner_id = auth.uid() or is_admin() or is_delete_admin());

drop policy if exists emissoes_ins on public.emissoes;
create policy emissoes_ins on public.emissoes for insert
with check (owner_id = auth.uid() or is_admin() or is_delete_admin());

drop policy if exists emissoes_upd on public.emissoes;
create policy emissoes_upd on public.emissoes for update
using (
  (owner_id = auth.uid() and (txid is null or status_pix = 'CANCELADO'))
  or is_delete_admin()
)
with check (
  (owner_id = auth.uid() and (txid is null or status_pix = 'CANCELADO'))
  or is_delete_admin()
);

drop policy if exists emissoes_del on public.emissoes;
create policy emissoes_del on public.emissoes for delete
using (
  (owner_id = auth.uid() and (
    (forma_cobranca is null and pix_txid is null and checkout_id is null and txid is null)
    or status_pix = 'CANCELADO'
  ))
  or is_delete_admin()
);
