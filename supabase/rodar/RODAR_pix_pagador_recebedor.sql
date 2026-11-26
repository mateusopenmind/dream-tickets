-- =============================================================================================
-- DreamTickets — dados do pagador/recebedor nos Pix (26/11/2026)
-- Rodar UMA vez no projeto Supabase qvtfxtneitigsgllplnk (SQL Editor ou psql).
-- Junta, nesta ordem:
--   1) supabase/migrations/20261126120000_pix_dados_pagador.sql
--   2) supabase/migrations/20261126130000_pagamentos_dados_recebedor.sql
-- Tudo dentro de uma transação: se qualquer parte falhar, nada fica aplicado.
-- Pode rodar de novo sem problema (idempotente).
-- =============================================================================================
begin;

-- Dados do pagador nos Pix recebidos (26/11/2026)
--
-- Grava QUEM pagou cada Pix de cobrança (emissões, terceirizadas, reembolsos a cobrar e
-- cobranças agrupadas), igual ao extrato do banco:
--   pagador_nome         -> nome / razão social de quem pagou       (vem do banco: GET /cob -> pix[].pagador)
--   pagador_documento    -> CPF ou CNPJ, só dígitos                  (idem)
--   pagador_ispb         -> ISPB da instituição de quem pagou        (extraído do endToEndId: E + 8 dígitos)
--   pagador_instituicao  -> nome da instituição (tabela pix_instituicoes)
--
-- Instituição: sai do próprio e2eid, então é preenchida por TRIGGER sempre que pix_e2eid é
-- gravado (qualquer banco, qualquer fluxo) e retroativamente no fim deste arquivo.
-- Nome/documento: só o banco sabe. Os fluxos n8n de conciliação chamam a RPC
-- registrar_pagador_pix(txid, e2eid, nome, documento) logo depois de confirmar no banco.

-- ---------------------------------------------------------------------------------------------
-- 1) Colunas
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['emissoes','emissoes_terceirizadas','reembolsos','cobrancas_agrupadas'] loop
    execute format('alter table public.%I add column if not exists pagador_nome text', t);
    execute format('alter table public.%I add column if not exists pagador_documento text', t);
    execute format('alter table public.%I add column if not exists pagador_ispb text', t);
    execute format('alter table public.%I add column if not exists pagador_instituicao text', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2) Instituições (ISPB -> nome). Semente com as mais comuns; ISPB desconhecido aparece como
--    "ISPB 12345678" até ser cadastrado aqui (insert ... on conflict do update).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.pix_instituicoes (
  ispb text primary key check (ispb ~ '^[0-9]{8}$'),
  nome text not null
);
alter table public.pix_instituicoes enable row level security;
drop policy if exists pix_instituicoes_sel on public.pix_instituicoes;
create policy pix_instituicoes_sel on public.pix_instituicoes for select to authenticated using (true);

insert into public.pix_instituicoes (ispb, nome) values
  ('00000000', 'BANCO DO BRASIL S.A.'),
  ('00000208', 'BRB - BANCO DE BRASILIA S.A.'),
  ('00360305', 'CAIXA ECONOMICA FEDERAL'),
  ('00416968', 'BANCO INTER S.A.'),
  ('01181521', 'BANCO COOPERATIVO SICREDI S.A.'),
  ('02038232', 'BANCO COOPERATIVO SICOOB S.A.'),
  ('04902979', 'BANCO DA AMAZONIA S.A.'),
  ('04913711', 'BANCO DO ESTADO DO PARA S.A.'),
  ('07237373', 'BANCO DO NORDESTE DO BRASIL S.A.'),
  ('08561701', 'PAGSEGURO INTERNET IP S.A.'),
  ('09089356', 'EFI S.A. - INSTITUICAO DE PAGAMENTO'),
  ('10573521', 'MERCADO PAGO IP LTDA.'),
  ('16501555', 'STONE INSTITUICAO DE PAGAMENTO S.A.'),
  ('17184037', 'BANCO MERCANTIL DO BRASIL S.A.'),
  ('18236120', 'NU PAGAMENTOS S.A.'),
  ('22896431', 'PICPAY'),
  ('30306294', 'BANCO BTG PACTUAL S.A.'),
  ('31872495', 'BANCO C6 S.A.'),
  ('33264668', 'BANCO XP S.A.'),
  ('58160789', 'BANCO SAFRA S.A.'),
  ('59588111', 'BANCO VOTORANTIM S.A.'),
  ('60701190', 'ITAU UNIBANCO S.A.'),
  ('60746948', 'BANCO BRADESCO S.A.'),
  ('61186680', 'BANCO BMG S.A.'),
  ('62232889', 'BANCO DAYCOVAL S.A.'),
  ('90400888', 'BANCO SANTANDER (BRASIL) S.A.'),
  ('92702067', 'BANCO DO ESTADO DO RIO GRANDE DO SUL S.A.'),
  ('92894922', 'BANCO ORIGINAL S.A.')
on conflict (ispb) do nothing;

create or replace function public.pix_ispb_do_e2eid(p_e2eid text)
returns text language sql immutable as $$
  select case when p_e2eid ~ '^[EeDd][0-9]{8}' then substr(p_e2eid, 2, 8) end
$$;

create or replace function public.pix_nome_instituicao(p_ispb text)
returns text language sql stable security definer set search_path = public as $$
  select case when p_ispb is null then null
              else coalesce((select nome from pix_instituicoes where ispb = p_ispb), 'ISPB ' || p_ispb) end
$$;

-- ---------------------------------------------------------------------------------------------
-- 3) Trigger: gravou/alterou pix_e2eid -> preenche ISPB e instituição
-- ---------------------------------------------------------------------------------------------
create or replace function public.tg_pix_pagador_instituicao()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.pix_e2eid is not null
     and (tg_op = 'INSERT' or new.pix_e2eid is distinct from old.pix_e2eid or new.pagador_instituicao is null) then
    new.pagador_ispb := coalesce(pix_ispb_do_e2eid(new.pix_e2eid), new.pagador_ispb);
    new.pagador_instituicao := coalesce(pix_nome_instituicao(new.pagador_ispb), new.pagador_instituicao);
  elsif new.pagador_ispb is not null and new.pagador_instituicao is null then
    new.pagador_instituicao := pix_nome_instituicao(new.pagador_ispb);
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['emissoes','emissoes_terceirizadas','reembolsos','cobrancas_agrupadas'] loop
    execute format('drop trigger if exists pix_pagador_instituicao on public.%I', t);
    execute format('create trigger pix_pagador_instituicao before insert or update of pix_e2eid, pagador_ispb on public.%I
                    for each row execute function public.tg_pix_pagador_instituicao()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4) RPC chamada pelo n8n depois que o BANCO confirmou o Pix (GET /cob -> CONCLUIDA).
--    Atualiza qualquer tabela que tenha esse txid e, se for cobrança agrupada, todos os itens.
--    Só grava dados do pagador; NÃO mexe em status/valor (isso continua com os nós de baixa).
--    Idempotente. Cada tabela num bloco próprio: erro numa não impede as outras.
-- ---------------------------------------------------------------------------------------------
create or replace function public.registrar_pagador_pix(p_txid text, p_e2eid text, p_nome text, p_documento text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
  v_doc  text := nullif(regexp_replace(coalesce(p_documento, ''), '[^0-9]', '', 'g'), '');
  v_ispb text := pix_ispb_do_e2eid(p_e2eid);
  v_inst text;
  v_grupo uuid;
  v_n int;
  v_res jsonb := '{}'::jsonb;
  t text;
begin
  if coalesce(p_txid, '') = '' then return null; end if;
  v_inst := pix_nome_instituicao(v_ispb);

  foreach t in array array['emissoes','emissoes_terceirizadas','reembolsos','cobrancas_agrupadas'] loop
    begin
      execute format($q$update %I set
                          pagador_nome        = coalesce($1, pagador_nome),
                          pagador_documento   = coalesce($2, pagador_documento),
                          pagador_ispb        = coalesce($3, pagador_ispb),
                          pagador_instituicao = coalesce($4, pagador_instituicao)
                        where pix_txid = $5$q$, t)
        using v_nome, v_doc, v_ispb, v_inst, p_txid;
      get diagnostics v_n = row_count;
      if v_n > 0 then v_res := v_res || jsonb_build_object(t, v_n); end if;
    exception when others then
      v_res := v_res || jsonb_build_object(t || '_erro', sqlerrm);
    end;
  end loop;

  -- Itens de cobrança agrupada (o txid é do grupo, não do item)
  select id into v_grupo from cobrancas_agrupadas where pix_txid = p_txid;
  if v_grupo is not null then
    foreach t in array array['emissoes','emissoes_terceirizadas','reembolsos'] loop
      begin
        execute format($q$update %I set
                            pagador_nome        = coalesce($1, pagador_nome),
                            pagador_documento   = coalesce($2, pagador_documento),
                            pagador_ispb        = coalesce($3, pagador_ispb),
                            pagador_instituicao = coalesce($4, pagador_instituicao)
                          where cobranca_agrupada_id = $5$q$, t)
          using v_nome, v_doc, v_ispb, v_inst, v_grupo;
        get diagnostics v_n = row_count;
        if v_n > 0 then v_res := v_res || jsonb_build_object(t || '_itens_grupo', v_n); end if;
      exception when others then
        v_res := v_res || jsonb_build_object(t || '_itens_grupo_erro', sqlerrm);
      end;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'txid', p_txid, 'atualizados', v_res);
end $$;

revoke all on function public.registrar_pagador_pix(text, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_pagador_pix(text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 5) Retroativo: instituição de todos os Pix já pagos (nome/documento só com nova consulta ao banco)
--    Gatilhos de negócio desligados SÓ durante este update: as tabelas têm gatilhos de UPDATE
--    (auditoria, valor facial, liquidação de reembolso zerado, saldo de pax) que não podem
--    rodar em massa sobre registros antigos. Só as colunas pagador_* são escritas.
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['emissoes','emissoes_terceirizadas','reembolsos','cobrancas_agrupadas'] loop
    execute format('alter table public.%I disable trigger user', t);
    execute format('update public.%I
                       set pagador_ispb = public.pix_ispb_do_e2eid(pix_e2eid),
                           pagador_instituicao = public.pix_nome_instituicao(public.pix_ispb_do_e2eid(pix_e2eid))
                     where pix_e2eid is not null and pagador_ispb is null', t);
    execute format('alter table public.%I enable trigger user', t);
  end loop;
end $$;

-- Dados do recebedor nos Pix PAGOS pelo sistema (26/11/2026)
--
-- Igual ao extrato do banco: quem recebeu, CPF/CNPJ, instituição, agência e conta.
-- Fonte: resposta do Sicoob no POST /pagamentos/confirmacao (bloco "destino"), gravada pelo
-- fluxo n8n "Pagamentos Pix: Executar Lote" via RPC pagamentos_gravar_recebedor.
-- Usado no comprovante (src/lib/comprovantePix.ts) e na tela Conferência Pix.
--
-- Depende de 20261126120000_pix_dados_pagador.sql (tabela pix_instituicoes e pix_nome_instituicao).

alter table public.pagamentos_lote_itens
  add column if not exists recebedor_nome        text,
  add column if not exists recebedor_documento   text,
  add column if not exists recebedor_ispb        text,
  add column if not exists recebedor_instituicao text,
  add column if not exists recebedor_agencia     text,
  add column if not exists recebedor_conta       text,
  add column if not exists recebedor_tipo_conta  text;

-- ISPB gravado -> nome da instituição
create or replace function public.tg_recebedor_instituicao()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.recebedor_ispb is not null
     and (tg_op = 'INSERT' or new.recebedor_ispb is distinct from old.recebedor_ispb or new.recebedor_instituicao is null) then
    new.recebedor_instituicao := pix_nome_instituicao(new.recebedor_ispb);
  end if;
  return new;
end $$;

drop trigger if exists recebedor_instituicao on public.pagamentos_lote_itens;
create trigger recebedor_instituicao before insert or update of recebedor_ispb on public.pagamentos_lote_itens
  for each row execute function public.tg_recebedor_instituicao();

-- Chamada pelo n8n logo depois da confirmação do pagamento.
-- O Pix é um só por grupo (grupo_chave): grava em todos os itens do grupo, para o
-- comprovante sair igual qualquer que seja a linha usada.
-- Confere o e2e: só aceita dados da resposta do pagamento DESTE item.
create or replace function public.pagamentos_gravar_recebedor(p_item uuid, p_e2e text, p_destino jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  it record;
  v_doc text;
  v_n int;
begin
  if p_item is null or p_destino is null or jsonb_typeof(p_destino) <> 'object' then return null; end if;
  select id, lote_id, grupo_chave, end_to_end_id into it from pagamentos_lote_itens where id = p_item;
  if it.id is null then return null; end if;
  if coalesce(p_e2e, '') <> '' and it.end_to_end_id is not null and it.end_to_end_id <> p_e2e then
    return jsonb_build_object('ok', false, 'motivo', 'e2e diferente do item');
  end if;

  v_doc := nullif(regexp_replace(coalesce(p_destino->>'cpfCnpj', p_destino->>'cpf', p_destino->>'cnpj', ''), '[^0-9]', '', 'g'), '');

  update pagamentos_lote_itens
     set recebedor_nome       = coalesce(nullif(btrim(p_destino->>'nome'), ''), recebedor_nome),
         recebedor_documento  = coalesce(v_doc, recebedor_documento),
         recebedor_ispb       = coalesce(nullif(p_destino->>'ispb', ''), recebedor_ispb),
         recebedor_agencia    = coalesce(nullif(p_destino->>'agencia', ''), recebedor_agencia),
         recebedor_conta      = coalesce(nullif(p_destino->>'conta', ''), recebedor_conta),
         recebedor_tipo_conta = coalesce(nullif(p_destino->>'tipo', ''), recebedor_tipo_conta)
   where id = it.id
      or (it.grupo_chave is not null and lote_id = it.lote_id and grupo_chave = it.grupo_chave);
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'itens', v_n);
end $$;

revoke all on function public.pagamentos_gravar_recebedor(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.pagamentos_gravar_recebedor(uuid, text, jsonb) to service_role;

-- Instituições vistas nos pagamentos reais que ainda não estavam na semente
insert into public.pix_instituicoes (ispb, nome) values
  ('37880206', 'CORA SOCIEDADE DE CREDITO DIRETO S.A.'),
  ('20855875', 'NEON PAGAMENTOS S.A.')
on conflict (ispb) do nothing;

-- Itens já gravados com esses ISPBs passam a mostrar o nome
update public.pagamentos_lote_itens set recebedor_instituicao = null, recebedor_ispb = recebedor_ispb
 where recebedor_ispb in ('37880206', '20855875');

-- Retroativo: pagamentos de 25/11/2026 cuja resposta do banco ainda estava no histórico do n8n
-- (execuções mais antigas já foram apagadas pelo n8n; esses ficam sem os dados do recebedor).
select public.pagamentos_gravar_recebedor(i.id, v.e2e, v.destino)
  from (values
  ('E04247370202611252237VYm5Q9p1djI', jsonb_build_object('nome','PAULO CEZAR BUSS TERIN SERVICOS DE GESTAO DE MILHAS AEREAS','cpfCnpj','59184525000177','ispb','37880206','conta','62860096','agencia','1','tipo','CONTAPAGAMENTO')),
  ('E042473702026112522376m82Zx0N4BI', jsonb_build_object('nome','FLYBIZ TURISMO CORPORATIVO LTDA','cpfCnpj','60272784000139','ispb','00416968','conta','0445615273','agencia','0001','tipo','CORRENTE')),
  ('E04247370202611252136SHHRAva44FW', jsonb_build_object('nome','MARLON REIS SCHNEIDER 83037195053','cpfCnpj','42971397000109','ispb','00416968','conta','0147342279','agencia','0001','tipo','CORRENTE')),
  ('E04247370202611252136QYtQs5nCXwx', jsonb_build_object('nome','MARLON REIS SCHNEIDER 83037195053','cpfCnpj','42971397000109','ispb','00416968','conta','0147342279','agencia','0001','tipo','CORRENTE')),
  ('E04247370202611251817VQiZlUYV5ac', jsonb_build_object('nome','PAX Viagens LTDA','cpfCnpj','45176365000100','ispb','22896431','conta','1283932326','agencia','1','tipo','CONTAPAGAMENTO')),
  ('E04247370202611251817KsbWVrpr9yC', jsonb_build_object('nome','MCG INTERMEDIACOES LTDA','cpfCnpj','44304163000133','ispb','90400888','conta','00000000000130058242','agencia','3235','tipo','CORRENTE')),
  ('E04247370202611251817rDToY5lV1JX', jsonb_build_object('nome','MCG INTERMEDIACOES LTDA','cpfCnpj','44304163000133','ispb','90400888','conta','00000000000130058242','agencia','3235','tipo','CORRENTE')),
  ('E04247370202611251818ZjlX6j8MrzG', jsonb_build_object('nome','MCG INTERMEDIACOES LTDA','cpfCnpj','44304163000133','ispb','90400888','conta','00000000000130058242','agencia','3235','tipo','CORRENTE')),
  ('E042473702026112518180FILJDI0FeA', jsonb_build_object('nome','PAX Viagens LTDA','cpfCnpj','45176365000100','ispb','22896431','conta','1283932326','agencia','1','tipo','CONTAPAGAMENTO')),
  ('E04247370202611251818wb1T5lF2Uus', jsonb_build_object('nome','MCG INTERMEDIACOES LTDA','cpfCnpj','44304163000133','ispb','90400888','conta','00000000000130058242','agencia','3235','tipo','CORRENTE'))
  ) as v(e2e, destino)
  join lateral (select id from public.pagamentos_lote_itens where end_to_end_id = v.e2e order by grupo_lider desc nulls last limit 1) i on true;

commit;

-- Conferência (deve mostrar: tabela pix_instituicoes, 16 colunas pagador_*, 7 recebedor_*, 2 funções)
select to_regclass('public.pix_instituicoes') as tabela,
       (select count(*) from information_schema.columns where table_schema='public' and column_name like 'pagador\_%') as colunas_pagador,
       (select count(*) from information_schema.columns where table_schema='public' and column_name like 'recebedor\_%') as colunas_recebedor,
       (select count(*) from pg_proc where proname in ('registrar_pagador_pix','pagamentos_gravar_recebedor')) as funcoes;
