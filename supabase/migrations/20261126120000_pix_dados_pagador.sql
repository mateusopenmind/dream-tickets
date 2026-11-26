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
