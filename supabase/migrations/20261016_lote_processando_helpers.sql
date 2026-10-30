-- APLICADA EM PRODUCAO em 16/10/2026.
-- Trava de lote em processamento — parte 1: como saber se um lote esta de fato rodando.
-- Motivo: ver secoes 7.20 e 7.21 de outros/INTEGRACAO_SICOOB_PIX_PAGAMENTOS.md.
create or replace function public.pagamentos_lote_mexeu(p_lote uuid)
returns timestamptz
language sql
stable
security definer
set search_path to 'public'
as $$
  select greatest(
           l.solicitado_em,
           coalesce(l.updated_at, l.solicitado_em),
           coalesce((select max(i.updated_at) from pagamentos_lote_itens i where i.lote_id = l.id),
                    l.solicitado_em))
  from pagamentos_lote l
  where l.id = p_lote;
$$;

-- Os 10 minutos de tolerancia moram AQUI, num lugar so: passado esse tempo sem nenhum
-- movimento, o lote e considerado travado e as travas liberam, para ninguem ficar preso
-- por causa de uma execucao do n8n que morreu no meio.
create or replace function public.pagamentos_lote_processando_agora(p_lote uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from pagamentos_lote l
    where l.id = p_lote
      and l.status in ('PREPARANDO','EXECUTANDO')
      and public.pagamentos_lote_mexeu(l.id) > now() - interval '10 minutes');
$$;

-- Qual lote esta processando agora (opcionalmente ignorando um). Serve ao gatilho, a
-- edge function e a tela, para o aviso sair igual nos tres lugares.
create or replace function public.pagamentos_lote_processando(p_ignorar uuid default null)
returns table (lote uuid, tipo text, status text, parado_s integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.id, l.tipo, l.status,
         floor(extract(epoch from (now() - public.pagamentos_lote_mexeu(l.id))))::integer
  from pagamentos_lote l
  where (p_ignorar is null or l.id <> p_ignorar)
    and public.pagamentos_lote_processando_agora(l.id)
  order by public.pagamentos_lote_mexeu(l.id) desc
  limit 1;
$$;
