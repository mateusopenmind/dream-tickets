-- Conferência de Compras: a compra só entra no estoque quando o crédito dos pontos é confirmado.
-- creditado_data/hora = quando os pontos caíram (é a data usada no saldo e no custo médio).
alter table public.estoque_compras
  add column if not exists creditado boolean not null default true,
  add column if not exists creditado_data date,
  add column if not exists creditado_hora time,
  add column if not exists creditado_em timestamptz,
  add column if not exists creditado_por uuid;

-- As compras já lançadas já estavam no estoque: ficam creditadas na própria data/hora da compra.
update public.estoque_compras
   set creditado = true, creditado_data = coalesce(creditado_data, data), creditado_hora = coalesce(creditado_hora, hora)
 where creditado_data is null;

comment on column public.estoque_compras.creditado is
  'false = compra lançada aguardando o crédito dos pontos (Conferência Compras). O app novo grava false ao lançar; default true preserva o app antigo.';
