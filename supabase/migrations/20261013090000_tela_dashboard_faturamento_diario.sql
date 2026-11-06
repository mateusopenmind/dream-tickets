-- Tela "Faturamento diário" (/dashboard-faturamento-diario), no menu Dashboard.
--
-- Calendário "Faturamento diário — semana × dia da semana" do Dashboard de
-- Faturamento numa tela própria, com os mesmos filtros. Só leitura.
--
-- IMPORTANTE: tela nova NÃO é liberada automaticamente para o papel operador.
-- Libera apenas para admin e super_admin; o resto, o Mateus/Bruno libera em Usuários.

insert into public.telas (chave, nome, fase, pronta, ordem)
values ('dashboard_faturamento_diario', 'Faturamento diário', 1, true, 1)
on conflict (chave) do update
  set nome = excluded.nome,
      pronta = excluded.pronta,
      ordem = excluded.ordem;

insert into public.usuario_telas (usuario_id, tela_id)
select p.id, t.id
from public.perfis_usuario p
cross join public.telas t
where t.chave = 'dashboard_faturamento_diario'
  and p.papel in ('admin', 'super_admin')
on conflict do nothing;
