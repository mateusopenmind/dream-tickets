-- Pix Pagamentos - fechamento do ciclo (14/09/2026)
--
-- Duas funcoes chamadas pelo n8n com a credencial do Supabase:
--   pagamentos_recalcular_lote  -> reapura qtd/valor/exige_codigo depois que itens caem fora
--   pagamentos_marcar_retorno   -> recebe o retorno do Sicoob e da baixa na tela de origem
--
-- Ambas SECURITY DEFINER: quem chama e o fluxo, nao o usuario. O cliente continua
-- so com SELECT nas tabelas de lote (nada de escrever pagamento pelo navegador).

-- ---------------------------------------------------------------- recalcular
create or replace function public.pagamentos_recalcular_lote(
  p_lote uuid,
  p_status text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_teto numeric;
begin
  select coalesce(teto_aplicado, 500) into v_teto from pagamentos_lote where id = p_lote;
  if not found then
    raise exception 'Lote % nao encontrado.', p_lote;
  end if;

  update pagamentos_lote l
  set qtd_itens    = s.qtd,
      valor_total  = s.total,
      exige_codigo = (s.total > v_teto),
      status       = coalesce(p_status, l.status),
      updated_at   = now()
  from (
    select count(*)                          filter (where estado not in ('BLOQUEADO','ERRO_INICIACAO','CANCELADO')) as qtd,
           coalesce(sum(valor),0)::numeric   filter (where estado not in ('BLOQUEADO','ERRO_INICIACAO','CANCELADO')) as total
    from pagamentos_lote_itens where lote_id = p_lote
  ) s
  where l.id = p_lote;
end;
$$;

-- ------------------------------------------------------------------- retorno
-- Idempotente de proposito: o Sicoob pode notificar o mesmo endToEndId mais de uma vez,
-- e a varredura periodica consulta os que nao notificaram. Item ja finalizado nao e
-- reprocessado, entao a baixa na origem nunca acontece duas vezes.
create or replace function public.pagamentos_marcar_retorno(
  p_e2e text,
  p_estado text,
  p_erro text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  it        pagamentos_lote_itens%rowtype;
  v_tipo    text;
  v_lote    uuid;
  v_sucesso boolean;
  v_rest    integer;
  v_falhas  integer;
begin
  if p_e2e is null or btrim(p_e2e) = '' then
    return jsonb_build_object('ok', false, 'motivo', 'endToEndId vazio');
  end if;

  select * into it from pagamentos_lote_itens where end_to_end_id = p_e2e limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'item nao encontrado para este endToEndId');
  end if;

  if it.estado in ('FINALIZADO_SUCESSO','FINALIZADO_REJEICAO') then
    return jsonb_build_object('ok', true, 'motivo', 'ja finalizado', 'item_id', it.id);
  end if;

  v_sucesso := (upper(coalesce(p_estado,'')) in ('FINALIZADO_SUCESSO','CONCLUIDO','SUCESSO','ACSC'));

  update pagamentos_lote_itens
  set estado  = case when v_sucesso then 'FINALIZADO_SUCESSO' else 'FINALIZADO_REJEICAO' end,
      pago_em = case when v_sucesso then now() else null end,
      erro    = case when v_sucesso then null else coalesce(p_erro, 'Pagamento rejeitado pelo banco.') end
  where id = it.id;

  select tipo into v_tipo from pagamentos_lote where id = it.lote_id;
  v_lote := it.lote_id;

  -- Baixa na tela de origem: so quando o dinheiro saiu de verdade.
  if v_sucesso then
    if it.origem_tabela = 'emissoes' then
      update emissoes
      set facial_pago            = true,
          pagar_facial           = coalesce(nullif(btrim(pagar_facial),''), round(it.valor)::text),
          data_pagto_facial      = (now() at time zone 'America/Sao_Paulo')::date,
          banco_pagamento_facial = 'Sicoob'
      where id = it.origem_id and coalesce(facial_pago,false) = false;

    elsif it.origem_tabela = 'emissoes_terceirizadas' then
      update emissoes_terceirizadas
      set fornecedor_pago             = true,
          data_pagamento_fornecedor   = (now() at time zone 'America/Sao_Paulo')::date,
          banco_pagamento_fornecedor  = 'Sicoob'
      where id = it.origem_id and coalesce(fornecedor_pago,false) = false;

    elsif it.origem_tabela = 'reembolsos' then
      update reembolsos
      set pago            = true,
          data_pagamento  = (now() at time zone 'America/Sao_Paulo')::date,
          banco_pagamento = 'Sicoob'
      where id = it.origem_id and coalesce(pago,false) = false;
    end if;
  end if;

  -- Fecha o lote quando nao sobrar nada em transito.
  select count(*) filter (where estado in ('PENDENTE','INICIADO','CONFIRMADO')),
         count(*) filter (where estado = 'FINALIZADO_REJEICAO')
    into v_rest, v_falhas
  from pagamentos_lote_itens where lote_id = v_lote;

  if v_rest = 0 then
    update pagamentos_lote
    set status = case when v_falhas > 0 then 'PARCIAL' else 'CONCLUIDO' end,
        updated_at = now()
    where id = v_lote and status in ('APROVADO','EXECUTANDO');
  end if;

  return jsonb_build_object('ok', true, 'item_id', it.id, 'lote_id', v_lote,
                            'tipo', v_tipo, 'sucesso', v_sucesso, 'em_transito', v_rest);
end;
$$;

revoke all on function public.pagamentos_recalcular_lote(uuid, text) from public, anon, authenticated;
revoke all on function public.pagamentos_marcar_retorno(text, text, text) from public, anon, authenticated;
grant execute on function public.pagamentos_recalcular_lote(uuid, text) to service_role;
grant execute on function public.pagamentos_marcar_retorno(text, text, text) to service_role;

comment on function public.pagamentos_recalcular_lote(uuid, text) is
  'Reapura qtd/valor/exige_codigo do lote depois que itens saem (chave invalida etc). Chamada pelo n8n.';
comment on function public.pagamentos_marcar_retorno(text, text, text) is
  'Retorno do Sicoob por endToEndId: finaliza o item, da baixa na origem quando pago e fecha o lote. Idempotente.';
