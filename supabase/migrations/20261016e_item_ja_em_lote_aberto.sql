-- APLICADA EM PRODUCAO em 16/10/2026 (em dois passos: 20261016e criou o gatilho,
-- 20261016f reescreveu a mensagem; este arquivo tem o resultado final).
--
-- Mensagem humana para o indice ux_pagamentos_item_origem_viva.
--
-- O indice impede a mesma emissao de estar viva em dois lotes ao mesmo tempo — e a trava
-- que evita pagar duas vezes a mesma coisa, e continua sendo ele quem manda. O que mudou
-- foi so a frase: a recusa chegava no operador como "duplicate key value violates unique
-- constraint ux_pagamentos_item_origem_viva", que nao diz o que houve nem o que fazer. E
-- acontece todo dia: basta sobrar um lote aberto e o operador marcar "todas" na tela de
-- origem.
--
-- Os dois motivos possiveis sao separados, porque a saida e diferente:
--   1) a emissao esta num lote ABERTO -> resolva aquele lote (aprove ou reverta);
--   2) a emissao JA FOI PAGA por Pix  -> ela nao entra em lote nenhum de novo.
create or replace function public.pagamentos_item_ja_em_lote_aberto()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_vivos    text[] := array['PENDENTE','INICIADO','CONFIRMADO','FINALIZADO_SUCESSO'];
  v_fechados text[] := array['CONCLUIDO','EXPIRADO','CANCELADO'];
  v_eu       text;
  v_estado   text;
  v_status   text;
  v_quando   text;
  v_quantos  integer;
  v_lista    text;
  v_onde     text;
begin
  if not (new.estado = any(v_vivos)) then
    return new;
  end if;

  -- Caminho normal: uma busca no proprio indice parcial e segue a vida.
  if not exists (
    select 1 from pagamentos_lote_itens i
    where i.origem_tabela = new.origem_tabela
      and i.origem_id = new.origem_id
      and i.estado = any(v_vivos)
  ) then
    return new;
  end if;

  v_eu := coalesce(nullif(btrim(new.localizador),''), new.referencia, 'esta emissão');

  -- O conflito desta emissao. Lote aberto vem primeiro: e o que o operador resolve.
  select i.estado, l.status,
         to_char(l.solicitado_em at time zone 'America/Sao_Paulo', 'DD/MM às HH24:MI')
    into v_estado, v_status, v_quando
  from pagamentos_lote_itens i
  join pagamentos_lote l on l.id = i.lote_id
  where i.origem_tabela = new.origem_tabela
    and i.origem_id = new.origem_id
    and i.estado = any(v_vivos)
  order by case when l.status = any(v_fechados) then 1 else 0 end, l.solicitado_em desc
  limit 1;

  if v_estado = 'FINALIZADO_SUCESSO' or v_status = any(v_fechados) then
    raise exception '% já foi paga por Pix (lote de %). Ela não pode entrar em outro lote. Se a baixa não apareceu na tela de origem, confira o lote antigo pelo Extrato antes de pagar de novo.',
      v_eu, coalesce(v_quando, 'data não identificada');
  end if;

  select count(*), string_agg(x.nome, ', ' order by x.nome)
    into v_quantos, v_lista
  from (
    select coalesce(nullif(btrim(i.localizador),''), i.referencia, '—') as nome
    from pagamentos_lote_itens i
    join pagamentos_lote l on l.id = i.lote_id
    where i.origem_tabela = new.origem_tabela
      and i.estado = any(v_vivos)
      and not (l.status = any(v_fechados))
      and i.lote_id is distinct from new.lote_id
    order by coalesce(nullif(btrim(i.localizador),''), i.referencia)
    limit 12
  ) x;

  v_onde := case v_status
    when 'PREPARANDO' then 'que ainda está consultando os titulares'
    when 'EXECUTANDO' then 'que está enviando os Pix'
    when 'AGUARDANDO_CONFERENCIA' then 'esperando conferência'
    when 'AGUARDANDO_APROVACAO' then 'esperando a aprovação'
    when 'APROVADO' then 'já aprovado e indo para o banco'
    else 'ainda aberto'
  end;

  raise exception 'Existe um lote de pagamento aberto, de %, % — e % está nele. A mesma emissão não pode estar em dois lotes. Abra a Conferência Pix e resolva esse lote (aprove ou reverta), ou tire da seleção %: %.',
    v_quando, v_onde, v_eu,
    case when v_quantos = 1 then 'a emissão que já está nele' else 'as ' || v_quantos || ' emissões que já estão nele' end,
    left(coalesce(v_lista, v_eu), 300);
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'pagamentos_item_ja_em_lote_aberto' and not tgisinternal
  ) then
    create trigger pagamentos_item_ja_em_lote_aberto
      before insert on public.pagamentos_lote_itens
      for each row execute function public.pagamentos_item_ja_em_lote_aberto();
  end if;
end $$;
