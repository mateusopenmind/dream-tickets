-- Correcao 18/09/2026: o lote ficava preso em EXECUTANDO.
--
-- O fluxo de execucao grava o estado do item e SO DEPOIS chama pagamentos_marcar_retorno.
-- Como o item ja chegava finalizado, a funcao saia no atalho "ja finalizado" e nunca
-- chegava na parte que fecha o lote. Resultado: itens certos, lote eternamente EXECUTANDO.
--
-- Agora o fechamento do lote e feito em TODOS os caminhos de saida, inclusive no atalho.
-- Continua idempotente: a baixa na origem so acontece uma vez, na primeira finalizacao.
create or replace function public.pagamentos_marcar_retorno(p_e2e text, p_estado text, p_erro text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  it        pagamentos_lote_itens%rowtype;
  v_tipo    text;
  v_lote    uuid;
  v_sucesso boolean;
  v_rest    integer;
  v_falhas  integer;
  v_ok      integer;
  v_novo    text;
  v_repetido boolean := false;
begin
  if p_e2e is null or btrim(p_e2e) = '' then
    return jsonb_build_object('ok', false, 'motivo', 'endToEndId vazio');
  end if;

  select * into it from pagamentos_lote_itens where end_to_end_id = p_e2e limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'item nao encontrado para este endToEndId');
  end if;

  v_lote := it.lote_id;
  select tipo into v_tipo from pagamentos_lote where id = v_lote;

  if it.estado in ('FINALIZADO_SUCESSO','FINALIZADO_REJEICAO') then
    -- Ja finalizado: nao reprocessa a baixa, mas AINDA ASSIM fecha o lote se for o caso.
    v_repetido := true;
    v_sucesso  := (it.estado = 'FINALIZADO_SUCESSO');
  else
    v_sucesso := (upper(coalesce(p_estado,'')) in ('FINALIZADO_SUCESSO','CONCLUIDO','SUCESSO','ACSC'));

    update pagamentos_lote_itens
    set estado  = case when v_sucesso then 'FINALIZADO_SUCESSO' else 'FINALIZADO_REJEICAO' end,
        pago_em = case when v_sucesso then now() else null end,
        erro    = case when v_sucesso then null else coalesce(p_erro, 'Pagamento rejeitado pelo banco.') end
    where id = it.id;

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
        set fornecedor_pago            = true,
            data_pagamento_fornecedor  = (now() at time zone 'America/Sao_Paulo')::date,
            banco_pagamento_fornecedor = 'Sicoob'
        where id = it.origem_id and coalesce(fornecedor_pago,false) = false;

      elsif it.origem_tabela = 'reembolsos' then
        update reembolsos
        set pago            = true,
            data_pagamento  = (now() at time zone 'America/Sao_Paulo')::date,
            banco_pagamento = 'Sicoob'
        where id = it.origem_id and coalesce(pago,false) = false;
      end if;
    end if;
  end if;

  -- Fecha o lote quando nao sobrar nada em transito. Roda tambem no caminho repetido,
  -- que e justamente o que o fluxo de execucao produz.
  select count(*) filter (where estado in ('PENDENTE','INICIADO','CONFIRMADO')),
         count(*) filter (where estado = 'FINALIZADO_REJEICAO'),
         count(*) filter (where estado = 'FINALIZADO_SUCESSO')
    into v_rest, v_falhas, v_ok
  from pagamentos_lote_itens where lote_id = v_lote;

  if v_rest = 0 then
    v_novo := case when v_falhas > 0 then 'PARCIAL' else 'CONCLUIDO' end;
    update pagamentos_lote
    set status = v_novo, updated_at = now()
    where id = v_lote and status in ('APROVADO','EXECUTANDO');
  end if;

  return jsonb_build_object('ok', true, 'item_id', it.id, 'lote_id', v_lote,
                            'tipo', v_tipo, 'sucesso', v_sucesso,
                            'repetido', v_repetido, 'em_transito', v_rest,
                            'status_lote', coalesce(v_novo, 'em andamento'));
end;
$function$;

revoke all on function public.pagamentos_marcar_retorno(text, text, text) from public;
grant execute on function public.pagamentos_marcar_retorno(text, text, text) to service_role;
