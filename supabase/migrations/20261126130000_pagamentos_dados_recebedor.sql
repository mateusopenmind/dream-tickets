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
