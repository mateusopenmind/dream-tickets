-- Tela "Dashboard de Faturamento" (/dashboard-faturamento).
--
-- Reproduz dentro do app o dashboard que o cliente montou a partir da planilha
-- (BI/Handoff_Dev/Dashboard_Faturamento.html). É uma tela só de leitura: consulta
-- `emissoes` e `emissoes_terceirizadas`, não grava nada.
--
-- IMPORTANTE: tela nova NÃO é liberada automaticamente para o papel operador.
-- Este script libera apenas para admin e super_admin. Quem mais precisar, o
-- Mateus/Bruno libera na tela de Usuários.

insert into public.telas (chave, nome, fase, pronta, ordem)
values ('dashboard_faturamento', 'Dashboard de Faturamento', 1, true, 1)
on conflict (chave) do update
  set nome = excluded.nome,
      pronta = excluded.pronta,
      ordem = excluded.ordem;

-- Libera para quem já é admin ou super_admin.
insert into public.usuario_telas (usuario_id, tela_id)
select p.id, t.id
from public.perfis_usuario p
cross join public.telas t
where t.chave = 'dashboard_faturamento'
  and p.papel in ('admin', 'super_admin')
on conflict do nothing;
