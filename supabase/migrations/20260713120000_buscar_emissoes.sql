-- Tela "Buscar Emissão": consulta global de emissões (normais + terceirizadas), somente leitura.
-- Qualquer usuário pode consultar QUALQUER emissão (inclusive de outros usuários) apenas para
-- leitura, através da função SECURITY DEFINER abaixo (ignora a RLS de dono das tabelas).
-- A EDIÇÃO continua governada pelas policies das tabelas: só o dono ou admin/super_admin editam.

create or replace function public.buscar_emissoes(termo text)
returns table (
  tabela_origem text,
  id uuid,
  id_emissao text,
  localizador text,
  programa text,
  nome_operacao text,
  emissor text,
  data_emissao date,
  hora time without time zone,
  data_voo_ida date,
  passageiros_qtd integer,
  cliente_codigo text,
  cliente_nome text,
  conta_codigo text,
  conta_nome text,
  cartao_codigo text,
  cartao_nome text,
  fornecedor_codigo text,
  fornecedor_nome text,
  milhas_cobrado numeric,
  total_milhas numeric,
  preco_milheiro numeric,
  taxas_cobrado numeric,
  taxas_tipo text,
  bagagens_cobrado numeric,
  bagagens_tipo text,
  assentos_cobrado numeric,
  assentos_tipo text,
  outros_cobrado numeric,
  outros_descricao text,
  preco_total numeric,
  status_pix text,
  forma_cobranca text,
  forma_paga text,
  valor_recebido numeric,
  data_recebimento timestamptz,
  facial boolean,
  observacao text,
  owner_id uuid,
  owner_nome text
)
language sql
stable
security definer
set search_path = public
as $$
  with t as (select nullif(trim(termo), '') as q)
  select
    'emissoes'::text, e.id, e.id_emissao, e.localizador, e.programa, e.nome_operacao, e.emissor,
    e.data_emissao, e.hora, e.data_voo_ida, e.passageiros_qtd,
    c.codigo, c.nome_fantasia, ct.codigo, ct.nome, ca.codigo, ca.nome,
    null::text, null::text,
    e.milhas_cobrado, e.total_milhas, e.preco_milheiro,
    e.taxas_cobrado, e.taxas_tipo, e.bagagens_cobrado, e.bagagens_tipo,
    e.assentos_cobrado, e.assentos_tipo, e.outros_cobrado, e.outros_descricao,
    e.preco_total, e.status_pix, e.forma_cobranca, e.forma_paga,
    e.valor_recebido, e.data_recebimento, e.facial, e.observacao,
    e.owner_id, p.nome
  from public.emissoes e
  cross join t
  left join public.clientes c on c.id = e.cliente_id
  left join public.contas ct on ct.id = e.conta_id
  left join public.cartoes ca on ca.id = e.cartao_id
  left join public.perfis_usuario p on p.id = e.owner_id
  where t.q is not null and (
    e.localizador ilike '%' || t.q || '%'
    or e.id_emissao ilike '%' || t.q || '%'
    or c.codigo ilike '%' || t.q || '%'
    or c.nome_fantasia ilike '%' || t.q || '%'
  )
  union all
  select
    'emissoes_terceirizadas'::text, e.id, e.id_emissao, e.localizador, e.programa, e.nome_operacao, e.emissor,
    e.data_emissao, e.hora, e.data_voo_ida, e.passageiros_qtd,
    c.codigo, c.nome_fantasia, null::text, null::text, null::text, null::text,
    f.codigo, f.nome,
    e.milhas_cobrado, e.total_milhas, e.preco_milheiro,
    e.taxas_cobrado, e.taxas_tipo, e.bagagens_cobrado, e.bagagens_tipo,
    e.assentos_cobrado, e.assentos_tipo, e.outros_cobrado, e.outros_descricao,
    e.preco_total, e.status_pix, e.forma_cobranca, e.forma_paga,
    e.valor_recebido, e.data_recebimento, null::boolean, e.observacao,
    e.owner_id, p.nome
  from public.emissoes_terceirizadas e
  cross join t
  left join public.clientes c on c.id = e.cliente_id
  left join public.fornecedores f on f.id = e.fornecedor_id
  left join public.perfis_usuario p on p.id = e.owner_id
  where t.q is not null and (
    e.localizador ilike '%' || t.q || '%'
    or e.id_emissao ilike '%' || t.q || '%'
    or c.codigo ilike '%' || t.q || '%'
    or c.nome_fantasia ilike '%' || t.q || '%'
  )
  order by 8 desc nulls last
  limit 200;
$$;

revoke all on function public.buscar_emissoes(text) from public, anon;
grant execute on function public.buscar_emissoes(text) to authenticated;

-- Tela nova (pronta) para o menu/RBAC.
insert into public.telas (chave, nome, fase, ordem, pronta)
values ('buscar_emissao', 'Buscar Emissão', 1, 23, true)
on conflict (chave) do update set nome = excluded.nome, pronta = true, ordem = excluded.ordem;

-- Libera a tela para TODOS os usuários atuais (pedido explícito: todos podem acessar).
insert into public.usuario_telas (usuario_id, tela_id)
select p.id, t.id
from public.perfis_usuario p
cross join public.telas t
where t.chave = 'buscar_emissao'
on conflict (usuario_id, tela_id) do nothing;
