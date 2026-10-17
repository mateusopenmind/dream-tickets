-- PENDENTE para a Conferencia Pix tem dois significados diferentes:
--   metodo = 'CHAVE'     -> falta consultar o titular no DICT
--   metodo = 'DEVOLUCAO' -> nao passa pelo DICT; o Pix volta pelo e2e de origem, e o item
--                           fica PENDENTE ate a execucao, o que esta CERTO.
--
-- A versao anterior encerrava TODO item PENDENTE do lote. Resultado em 01/10/2026: o
-- reembolso BR000172 (devolucao, R$ 979,85) foi morto com a mensagem "o banco bloqueou as
-- consultas por excesso de chamadas", que nem tinha acontecido — o banco nao chegou a ser
-- chamado para ele. Agora so encerra quem o fluxo do DICT deveria ter consultado.
create or replace function public.pagamentos_encerrar_pendentes(p_lote uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_qtd integer;
begin
  update pagamentos_lote_itens
  set estado = 'ERRO_INICIACAO',
      erro   = 'O banco bloqueou as consultas por excesso de chamadas e nao liberou a tempo. Tente de novo daqui a alguns minutos.'
  where lote_id = p_lote
    and estado  = 'PENDENTE'
    and metodo  = 'CHAVE'
    and end_to_end_id is null;

  get diagnostics v_qtd = row_count;
  return jsonb_build_object('ok', true, 'encerrados', v_qtd);
end;
$$;

revoke all on function public.pagamentos_encerrar_pendentes(uuid) from public;
grant execute on function public.pagamentos_encerrar_pendentes(uuid) to anon, authenticated, service_role;

-- Conserto do estrago: devolve ao estado PENDENTE as devolucoes que foram encerradas por
-- engano, em lotes que ainda nao foram aprovados.
update pagamentos_lote_itens i
set estado = 'PENDENTE', erro = null
from pagamentos_lote l
where l.id = i.lote_id
  and i.estado = 'ERRO_INICIACAO'
  and i.metodo = 'DEVOLUCAO'
  and i.erro like 'O banco bloqueou as consultas%'
  and l.status in ('PREPARANDO','AGUARDANDO_CONFERENCIA','AGUARDANDO_APROVACAO');
