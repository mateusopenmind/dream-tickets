-- Descricao que viaja no Pix de pagamento (o que o favorecido ve no extrato dele).
-- Padrao definido pelo Mateus em 14/09/2026, igual ao combinado com o cliente:
--   Facial      -> o codigo da CONTA            ex.: P120
--   Fornecedor  -> o LOCALIZADOR                ex.: ABCDEF
--   Reembolso   -> "Reembolso " + LOCALIZADOR   ex.: Reembolso ABCDEF
-- Um Pix por linha (por localizador), que ja era o desenho: cada item do lote e uma
-- emissao/reembolso, nunca um valor somado por favorecido.
-- Se o campo principal estiver vazio, cai para a referencia — nunca sai Pix sem
-- identificacao nenhuma no extrato de quem recebe.
create or replace function public.pagamentos_montar_lote(
  p_tipo text,
  p_ids uuid[],
  p_valor_unitario numeric default null,
  p_teto numeric default 500
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lote uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;
  if p_tipo not in ('facial','fornecedor','reembolso') then
    raise exception 'Tipo invalido: %', p_tipo;
  end if;
  if p_ids is null or array_length(p_ids,1) is null then
    raise exception 'Nenhum item selecionado.';
  end if;

  insert into pagamentos_lote (tipo, status, teto_aplicado, owner_id, solicitado_por)
  values (p_tipo, 'PREPARANDO', p_teto, auth.uid(), auth.uid())
  returning id into v_lote;

  if p_tipo = 'fornecedor' then
    insert into pagamentos_lote_itens
      (lote_id, origem_tabela, origem_id, referencia, localizador, chave_pix, valor,
       descricao, nome_cadastro, metodo, estado, erro)
    select v_lote, 'emissoes_terceirizadas', e.id, e.id_emissao, e.localizador,
           nullif(btrim(f.chave_pix),''), e.custo_total,
           left(coalesce(nullif(btrim(e.localizador),''), coalesce(e.id_emissao,'')), 140),
           f.nome, 'CHAVE',
           case when nullif(btrim(f.chave_pix),'') is null then 'BLOQUEADO' else 'PENDENTE' end,
           case when nullif(btrim(f.chave_pix),'') is null
                then 'Fornecedor sem chave Pix cadastrada (Cadastros > Fornecedores).' end
    from emissoes_terceirizadas e
    left join fornecedores f on f.id = e.fornecedor_id
    where e.id = any(p_ids)
      and coalesce(e.fornecedor_pago,false) = false
      and coalesce(e.custo_total,0) > 0;

  elsif p_tipo = 'facial' then
    if coalesce(p_valor_unitario,0) <= 0 then
      raise exception 'Informe o valor por emissao.';
    end if;
    insert into pagamentos_lote_itens
      (lote_id, origem_tabela, origem_id, referencia, localizador, chave_pix, valor,
       descricao, nome_cadastro, metodo, estado, erro)
    select v_lote, 'emissoes', e.id, e.id_emissao, e.localizador,
           nullif(btrim(c.pix_envio),''), p_valor_unitario,
           left(coalesce(nullif(btrim(c.codigo),''), 'Facial ' || coalesce(e.id_emissao,'')), 140),
           c.nome, 'CHAVE',
           case when nullif(btrim(c.pix_envio),'') is null then 'BLOQUEADO' else 'PENDENTE' end,
           case when nullif(btrim(c.pix_envio),'') is null
                then 'Conta sem Chave Pix (envio) cadastrada (Cadastros > Contas).' end
    from emissoes e
    left join contas c on c.id = e.conta_id
    where e.id = any(p_ids)
      and coalesce(e.facial_pago,false) = false;

  else
    -- Reembolso: devolve pelo Pix de origem quando der; senao paga na chave do cliente.
    insert into pagamentos_lote_itens
      (lote_id, origem_tabela, origem_id, referencia, localizador, chave_pix, valor,
       descricao, nome_cadastro, metodo, e2e_original, estado, erro)
    select v_lote, 'reembolsos', r.id, r.reembolso_id, r.localizador,
           nullif(btrim(cl.chave_pix),''), r.total_cliente,
           left('Reembolso ' || coalesce(nullif(btrim(r.localizador),''), coalesce(r.reembolso_id,'')), 140),
           cl.nome_fantasia,
           case when d.e2e is not null then 'DEVOLUCAO' else 'CHAVE' end,
           d.e2e,
           case when d.e2e is not null then 'PENDENTE'
                when nullif(btrim(cl.chave_pix),'') is not null then 'PENDENTE'
                else 'BLOQUEADO' end,
           case when d.e2e is null and nullif(btrim(cl.chave_pix),'') is null
                then 'Sem Pix de origem no Sicoob e cliente sem Chave Pix cadastrada (Cadastros > Clientes).' end
    from reembolsos r
    left join clientes cl on cl.id = r.cliente_id
    left join lateral (
      select e.pix_e2eid as e2e
      from emissoes e
      where e.id = r.emissao_id
        and coalesce(r.tabela_origem,'emissoes') = 'emissoes'
        and e.pix_e2eid is not null
        and lower(coalesce(e.pix_banco,'')) = 'sicoob'
        and coalesce(e.data_recebimento, now()) > now() - interval '90 days'
    ) d on true
    where r.id = any(p_ids)
      and coalesce(r.pago,false) = false
      and coalesce(r.total_cliente,0) > 0;
  end if;

  update pagamentos_lote l
  set qtd_itens = s.qtd,
      valor_total = s.total,
      exige_codigo = (s.total > p_teto),
      status = 'AGUARDANDO_CONFERENCIA'
  from (
    select count(*) filter (where estado <> 'BLOQUEADO') as qtd,
           coalesce(sum(valor) filter (where estado <> 'BLOQUEADO'),0) as total
    from pagamentos_lote_itens where lote_id = v_lote
  ) s
  where l.id = v_lote;

  return v_lote;
end;
$function$;
