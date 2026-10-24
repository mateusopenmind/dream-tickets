-- Cobrança agrupada (30/09/2026)
-- Junta várias cobranças EM ABERTO do mesmo cliente (emissões, terceirizadas e reembolsos a
-- cobrar) num Pix só. Os Pix individuais são cancelados no banco e um Pix novo, com o total,
-- é gerado para o grupo. Quando o grupo é pago, todos os itens viram PAGO juntos.
--
-- Estados do grupo (status_pix):
--   GERANDO   -> grupo criado, n8n cancelando os Pix individuais e gerando o Pix do grupo
--   EM ABERTO -> Pix do grupo gerado, aguardando pagamento
--   PAGO      -> pago; itens baixados como PAGO
--   CANCELADO -> desagrupado (ou falha ao gerar); itens voltaram a ser cobranças individuais
--
-- Os itens continuam com status_pix = 'EM ABERTO' enquanto o grupo está aberto (continuam
-- sendo contas a receber em todos os relatórios); o vínculo é a coluna cobranca_agrupada_id.
-- As colunas do grupo têm os MESMOS nomes das colunas de cobrança das emissões para que os
-- fluxos n8n de cobrança (Sicoob/Sicredi) gravem o Pix do grupo sem código especial.

create sequence if not exists public.cobrancas_agrupadas_seq;

create table if not exists public.cobrancas_agrupadas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  cliente_id uuid not null references public.clientes(id),
  owner_id uuid default auth.uid(),
  preco_total numeric not null check (preco_total > 0),
  qtd_itens int not null,
  localizadores text,
  itens jsonb not null default '[]'::jsonb,
  status_pix text not null default 'GERANDO' check (status_pix in ('GERANDO','EM ABERTO','PAGO','CANCELADO')),
  forma_cobranca text,
  pix_txid text,
  pix_copia_cola text,
  pix_banco text,
  data_cobranca timestamptz,
  cancelar boolean default false,
  obs_pix text,
  pix_e2eid text,
  valor_recebido numeric,
  data_recebimento timestamptz,
  forma_paga text,
  fone_destino text,
  motivo_encerramento text,
  encerrado_em timestamptz,
  created_at timestamptz default now(),
  created_by uuid,
  updated_at timestamptz default now(),
  updated_by uuid
);
create index if not exists cobrancas_agrupadas_txid_idx on public.cobrancas_agrupadas (pix_txid);
create index if not exists cobrancas_agrupadas_status_idx on public.cobrancas_agrupadas (status_pix);
create index if not exists cobrancas_agrupadas_cliente_idx on public.cobrancas_agrupadas (cliente_id);

drop trigger if exists trg_set_audit_fields on public.cobrancas_agrupadas;
create trigger trg_set_audit_fields before insert or update on public.cobrancas_agrupadas
  for each row execute function public.set_audit_fields();

alter table public.cobrancas_agrupadas enable row level security;
drop policy if exists cobrancas_agrupadas_sel on public.cobrancas_agrupadas;
create policy cobrancas_agrupadas_sel on public.cobrancas_agrupadas for select to authenticated
  using ((owner_id = (select auth.uid())) or (select is_admin()) or (select is_delete_admin()));
-- Sem policy de insert/update/delete: só as funções abaixo (SECURITY DEFINER) e o n8n (service_role) escrevem.

alter table public.emissoes               add column if not exists cobranca_agrupada_id uuid references public.cobrancas_agrupadas(id) on delete set null;
alter table public.emissoes_terceirizadas add column if not exists cobranca_agrupada_id uuid references public.cobrancas_agrupadas(id) on delete set null;
alter table public.reembolsos             add column if not exists cobranca_agrupada_id uuid references public.cobrancas_agrupadas(id) on delete set null;
create index if not exists emissoes_cobranca_agrupada_idx               on public.emissoes (cobranca_agrupada_id) where cobranca_agrupada_id is not null;
create index if not exists emissoes_terceirizadas_cobranca_agrupada_idx on public.emissoes_terceirizadas (cobranca_agrupada_id) where cobranca_agrupada_id is not null;
create index if not exists reembolsos_cobranca_agrupada_idx             on public.reembolsos (cobranca_agrupada_id) where cobranca_agrupada_id is not null;

-- ---------------------------------------------------------------------------------------------
-- Trava: enquanto o grupo está aberto (GERANDO / EM ABERTO), o item não pode mudar de status,
-- forma de cobrança, txid ou valor, nem ser excluído — senão o Pix do grupo cobraria algo
-- diferente do que está no sistema. Só as funções do agrupamento (que ligam a flag
-- dream.agrupamento na transação) mexem nesses campos.
-- ---------------------------------------------------------------------------------------------
create or replace function public.guard_item_agrupado()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_grupo uuid; v_codigo text; v_status text;
begin
  if coalesce(current_setting('dream.agrupamento', true), '') = '1' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and old.cobranca_agrupada_id is null and new.cobranca_agrupada_id is not null then
    raise exception 'O vínculo com cobrança agrupada só pode ser feito pela tela Cobranças em Aberto.' using errcode = 'P0001';
  end if;

  v_grupo := old.cobranca_agrupada_id;
  if v_grupo is null then return coalesce(new, old); end if;

  select codigo, status_pix into v_codigo, v_status from cobrancas_agrupadas where id = v_grupo;
  if v_status is null or v_status not in ('GERANDO', 'EM ABERTO') then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Esta cobrança faz parte da cobrança agrupada % (em aberto). Desagrupe antes de excluir.', v_codigo using errcode = 'P0001';
  end if;

  if new.status_pix is distinct from old.status_pix
     or new.forma_cobranca is distinct from old.forma_cobranca
     or new.pix_txid is distinct from old.pix_txid
     or new.preco_total is distinct from old.preco_total
     or new.cobranca_agrupada_id is distinct from old.cobranca_agrupada_id then
    raise exception 'Esta cobrança faz parte da cobrança agrupada % (em aberto). Desagrupe em Cobranças em Aberto antes de alterar a cobrança ou o valor.', v_codigo using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_item_agrupado on public.emissoes;
create trigger trg_guard_item_agrupado before update or delete on public.emissoes
  for each row execute function public.guard_item_agrupado();
drop trigger if exists trg_guard_item_agrupado on public.emissoes_terceirizadas;
create trigger trg_guard_item_agrupado before update or delete on public.emissoes_terceirizadas
  for each row execute function public.guard_item_agrupado();
drop trigger if exists trg_guard_item_agrupado on public.reembolsos;
create trigger trg_guard_item_agrupado before update or delete on public.reembolsos
  for each row execute function public.guard_item_agrupado();

-- ---------------------------------------------------------------------------------------------
-- 1) Criar o grupo (chamada pelo app, com o usuário logado, via edge function cobranca-agrupada)
--    p_itens = [{ "tabela": "emissoes", "id": "<uuid>" }, ...]
-- ---------------------------------------------------------------------------------------------
create or replace function public.criar_cobranca_agrupada(p_itens jsonb, p_fone text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_it jsonb;
  v_tab text;
  v_id uuid;
  r record;
  v_cliente uuid;
  v_total numeric := 0;
  v_itens jsonb := '[]'::jsonb;
  v_locs text[] := '{}';
  v_vistos text[] := '{}';
  v_codigo text;
  v_grupo uuid;
  v_n int;
  v_ordem int := 0;
begin
  if v_uid is null then raise exception 'Não autenticado.' using errcode = 'P0001'; end if;
  if not exists (select 1 from perfis_usuario where id = v_uid and ativo) then
    raise exception 'Usuário inativo.' using errcode = 'P0001';
  end if;
  if not (is_super_admin() or exists (
      select 1 from usuario_telas ut join telas t on t.id = ut.tela_id
       where ut.usuario_id = v_uid and t.chave = 'cobrancas_agrupar')) then
    raise exception 'Você não tem permissão para agrupar cobranças.' using errcode = 'P0001';
  end if;

  v_n := coalesce(jsonb_array_length(p_itens), 0);
  if v_n < 2 then raise exception 'Selecione pelo menos 2 cobranças para agrupar.' using errcode = 'P0001'; end if;
  if v_n > 40 then raise exception 'Máximo de 40 cobranças por agrupamento.' using errcode = 'P0001'; end if;

  for v_it in select * from jsonb_array_elements(p_itens) loop
    v_tab := v_it->>'tabela';
    v_id := (v_it->>'id')::uuid;
    if v_tab not in ('emissoes', 'emissoes_terceirizadas', 'reembolsos') then
      raise exception 'Tabela inválida: %', v_tab using errcode = 'P0001';
    end if;
    if (v_tab || ':' || v_id) = any(v_vistos) then
      raise exception 'Cobrança repetida na seleção.' using errcode = 'P0001';
    end if;
    v_vistos := v_vistos || (v_tab || ':' || v_id);

    if v_tab = 'reembolsos' then
      select x.id, x.cliente_id, x.owner_id, x.status_pix, x.forma_cobranca, x.cobranca_agrupada_id,
             coalesce(x.preco_total, 0) as preco_total, x.localizador, x.programa,
             x.reembolso_id as codigo,
             ('Reembolso ' || coalesce(x.tipo, 'total')) as operacao,
             x.pix_txid, x.pix_banco, true as pode_ver
        into r from reembolsos x where x.id = v_id for update;
    else
      execute format($q$
        select x.id, x.cliente_id, x.owner_id, x.status_pix, x.forma_cobranca, x.cobranca_agrupada_id,
               coalesce(x.preco_total, 0) as preco_total, x.localizador, x.programa,
               x.id_emissao as codigo, x.nome_operacao as operacao,
               x.pix_txid, x.pix_banco,
               (x.owner_id = $2 or is_admin() or is_delete_admin()) as pode_ver
          from %I x where x.id = $1 for update$q$, v_tab)
        into r using v_id, v_uid;
    end if;

    if r.id is null or not r.pode_ver then
      raise exception 'Cobrança não encontrada.' using errcode = 'P0001';
    end if;
    if coalesce(r.status_pix, '') <> 'EM ABERTO' then
      raise exception 'A cobrança % não está EM ABERTO (está %).', r.codigo, coalesce(r.status_pix, 'sem status') using errcode = 'P0001';
    end if;
    if r.cobranca_agrupada_id is not null then
      raise exception 'A cobrança % já está em outra cobrança agrupada.', r.codigo using errcode = 'P0001';
    end if;
    if coalesce(r.forma_cobranca, 'pix') <> 'pix' then
      raise exception 'A cobrança % tem forma de cobrança "%" (ex.: recebimento avulso lançado) e não pode ser agrupada.', r.codigo, r.forma_cobranca using errcode = 'P0001';
    end if;
    if r.preco_total <= 0 then
      raise exception 'A cobrança % está sem valor.', r.codigo using errcode = 'P0001';
    end if;
    if r.cliente_id is null then
      raise exception 'A cobrança % está sem cliente.', r.codigo using errcode = 'P0001';
    end if;
    if v_cliente is null then v_cliente := r.cliente_id;
    elsif v_cliente <> r.cliente_id then
      raise exception 'Só é possível agrupar cobranças do MESMO cliente.' using errcode = 'P0001';
    end if;

    v_ordem := v_ordem + 1;
    v_total := v_total + r.preco_total;
    if nullif(trim(coalesce(r.localizador, '')), '') is not null then
      v_locs := v_locs || trim(r.localizador);
    end if;
    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'ordem', v_ordem, 'tabela', v_tab, 'id', r.id, 'codigo', r.codigo,
      'localizador', nullif(trim(coalesce(r.localizador, '')), ''),
      'programa', r.programa, 'operacao', r.operacao, 'valor', round(r.preco_total, 2),
      'pix_txid', r.pix_txid, 'pix_banco', lower(coalesce(r.pix_banco, ''))));
  end loop;

  v_codigo := 'G' || lpad(nextval('cobrancas_agrupadas_seq')::text, 6, '0');

  insert into cobrancas_agrupadas (codigo, cliente_id, owner_id, preco_total, qtd_itens, localizadores, itens, status_pix, fone_destino)
  values (v_codigo, v_cliente, v_uid, round(v_total, 2), v_n, array_to_string(v_locs, ', '), v_itens, 'GERANDO', nullif(p_fone, ''))
  returning id into v_grupo;

  perform set_config('dream.agrupamento', '1', true);
  for v_it in select * from jsonb_array_elements(v_itens) loop
    execute format('update %I set cobranca_agrupada_id = $1, forma_cobranca = ''pix'' where id = $2', v_it->>'tabela')
      using v_grupo, (v_it->>'id')::uuid;
  end loop;
  perform set_config('dream.agrupamento', '', true);

  return jsonb_build_object('id', v_grupo, 'codigo', v_codigo, 'valor', round(v_total, 2), 'qtd', v_n);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2) Depois que o n8n cancelou no banco os Pix individuais: limpa o Pix antigo dos itens
--    (senão o link /pix/<txid antigo> e a conferência de 15 min continuariam olhando para ele).
-- ---------------------------------------------------------------------------------------------
create or replace function public.agrupamento_individuais_cancelados(p_grupo uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g record; v_it jsonb; v_obs text; v_n int := 0;
begin
  select * into g from cobrancas_agrupadas where id = p_grupo for update;
  if g.id is null then raise exception 'Agrupamento não encontrado.'; end if;
  if g.status_pix <> 'GERANDO' then raise exception 'Agrupamento % não está em geração (status %).', g.codigo, g.status_pix; end if;
  v_obs := 'Pix individual cancelado em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
           || ' — cobrado na cobrança agrupada ' || g.codigo;
  perform set_config('dream.agrupamento', '1', true);
  for v_it in select * from jsonb_array_elements(g.itens) loop
    execute format('update %I set pix_txid = null, pix_copia_cola = null, cancelar = false, obs_pix = $1 where id = $2 and cobranca_agrupada_id = $3', v_it->>'tabela')
      using v_obs, (v_it->>'id')::uuid, p_grupo;
    v_n := v_n + 1;
  end loop;
  perform set_config('dream.agrupamento', '', true);
  return jsonb_build_object('ok', true, 'itens', v_n);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3) Desfazer o grupo (desagrupar, ou falha ao gerar). Itens sem Pix vivo ficam liberados para
--    uma nova cobrança individual (forma_cobranca = null). Devolve a lista para o n8n recobrar.
-- ---------------------------------------------------------------------------------------------
create or replace function public.agrupamento_desfazer(p_grupo uuid, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g record; v_it jsonb; v_txid text; v_out jsonb := '[]'::jsonb; v_obs text;
begin
  select * into g from cobrancas_agrupadas where id = p_grupo for update;
  if g.id is null then raise exception 'Agrupamento não encontrado.'; end if;
  if g.status_pix not in ('GERANDO', 'EM ABERTO') then
    raise exception 'Agrupamento % não pode ser desfeito (status %).', g.codigo, g.status_pix;
  end if;
  v_obs := 'Saiu da cobrança agrupada ' || g.codigo || ' em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
           || coalesce(' — ' || nullif(p_motivo, ''), '');

  perform set_config('dream.agrupamento', '1', true);
  update cobrancas_agrupadas
     set status_pix = 'CANCELADO', cancelar = true, motivo_encerramento = nullif(p_motivo, ''), encerrado_em = now()
   where id = p_grupo;

  for v_it in select * from jsonb_array_elements(g.itens) loop
    v_txid := null;
    execute format('select pix_txid from %I where id = $1 and cobranca_agrupada_id = $2', v_it->>'tabela')
      into v_txid using (v_it->>'id')::uuid, p_grupo;
    execute format($q$update %I set cobranca_agrupada_id = null,
                         forma_cobranca = case when pix_txid is null then null else forma_cobranca end,
                         obs_pix = case when pix_txid is null then $1 else obs_pix end
                   where id = $2 and cobranca_agrupada_id = $3$q$, v_it->>'tabela')
      using v_obs, (v_it->>'id')::uuid, p_grupo;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'tabela', v_it->>'tabela', 'id', v_it->>'id', 'codigo', v_it->>'codigo',
      'recobrar', (v_txid is null)));
  end loop;
  perform set_config('dream.agrupamento', '', true);

  return jsonb_build_object('ok', true, 'codigo', g.codigo, 'owner_id', g.owner_id, 'fone_destino', g.fone_destino, 'itens', v_out);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4) Baixa do Pix do grupo (chamada pela conciliação/conferência DEPOIS de o banco confirmar
--    CONCLUIDA). Idempotente: grupo já pago ou txid desconhecido -> devolve null.
-- ---------------------------------------------------------------------------------------------
create or replace function public.baixar_cobranca_agrupada(p_txid text, p_e2eid text, p_valor numeric, p_horario timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g record; v_it jsonb; v_obs text; v_fone text; v_itens jsonb := '[]'::jsonb; v_valor numeric;
begin
  if coalesce(p_txid, '') = '' then return null; end if;
  select * into g from cobrancas_agrupadas where pix_txid = p_txid for update;
  if g.id is null or g.status_pix <> 'EM ABERTO' then return null; end if;

  v_obs := 'Pago na cobrança agrupada ' || g.codigo || ' (' || g.qtd_itens || ' itens, total R$ '
           || replace(replace(replace(to_char(coalesce(p_valor, g.preco_total), 'FM999G999G990D00'), ',', '§'), '.', ','), '§', '.') || ')';

  perform set_config('dream.agrupamento', '1', true);
  update cobrancas_agrupadas
     set status_pix = 'PAGO', forma_paga = 'pix', pix_e2eid = p_e2eid, valor_recebido = p_valor,
         data_recebimento = coalesce(p_horario, now()), encerrado_em = now()
   where id = g.id;

  for v_it in select * from jsonb_array_elements(g.itens) loop
    v_valor := (v_it->>'valor')::numeric;
    execute format($q$update %I set status_pix = 'PAGO', forma_paga = 'pix', pix_e2eid = $1,
                          valor_recebido = coalesce(preco_total, $2), data_recebimento = $3,
                          pix_banco = $4, obs_pix = $5
                     where id = $6 and cobranca_agrupada_id = $7 and status_pix = 'EM ABERTO'$q$, v_it->>'tabela')
      using p_e2eid, v_valor, coalesce(p_horario, now()), g.pix_banco, v_obs, (v_it->>'id')::uuid, g.id;
    v_itens := v_itens || jsonb_build_array(jsonb_build_object('codigo', v_it->>'codigo', 'localizador', v_it->>'localizador', 'valor', v_valor));
  end loop;
  perform set_config('dream.agrupamento', '', true);

  select whatsapp into v_fone from perfis_usuario where id = g.owner_id;
  return jsonb_build_object('ok', true, 'codigo', g.codigo, 'valor', p_valor, 'horario', coalesce(p_horario, now()),
                            'fone', coalesce(nullif(v_fone, ''), g.fone_destino), 'itens', v_itens);
end $$;

revoke all on function public.criar_cobranca_agrupada(jsonb, text) from public, anon;
grant execute on function public.criar_cobranca_agrupada(jsonb, text) to authenticated;
revoke all on function public.agrupamento_individuais_cancelados(uuid) from public, anon, authenticated;
revoke all on function public.agrupamento_desfazer(uuid, text) from public, anon, authenticated;
revoke all on function public.baixar_cobranca_agrupada(text, text, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.agrupamento_individuais_cancelados(uuid) to service_role;
grant execute on function public.agrupamento_desfazer(uuid, text) to service_role;
grant execute on function public.baixar_cobranca_agrupada(text, text, numeric, timestamptz) to service_role;
revoke all on function public.guard_item_agrupado() from public, anon, authenticated;

-- Permissão (RBAC): ação dentro de Cobranças em Aberto. Liberada só para admin; operador NUNCA
-- ganha tela nova automaticamente (super_admin vê tudo).
insert into public.telas (chave, nome, fase, pronta, ordem)
select 'cobrancas_agrupar', 'Agrupar Cobranças (Pix único)', 1, true, 22
where not exists (select 1 from public.telas where chave = 'cobrancas_agrupar');

insert into public.usuario_telas (usuario_id, tela_id)
select p.id, t.id from public.perfis_usuario p cross join public.telas t
 where t.chave = 'cobrancas_agrupar' and p.papel = 'admin' and p.ativo
   and not exists (select 1 from public.usuario_telas ut where ut.usuario_id = p.id and ut.tela_id = t.id);
