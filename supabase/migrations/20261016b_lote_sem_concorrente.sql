-- APLICADA EM PRODUCAO em 16/10/2026.
-- Trava de lote em processamento — parte 2: nao montar outro lote enquanto um esta
-- rodando. Gatilho no insert, e nao validacao dentro de pagamentos_montar_lote, para
-- pegar qualquer caminho que crie lote, hoje e amanha.
create or replace function public.pagamentos_barrar_lote_concorrente()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v record;
begin
  select * into v from public.pagamentos_lote_processando(new.id);
  if v.lote is not null then
    raise exception 'Já existe um lote de % %. Espere ele terminar antes de montar outro: o banco bloqueia o acesso de todos quando recebe chamadas de mais de um lote ao mesmo tempo. Se ele estiver travado, depois de 10 minutos sem movimento o sistema libera.',
      v.tipo,
      case v.status
        when 'PREPARANDO' then 'consultando os titulares no Banco Central'
        when 'EXECUTANDO' then 'enviando os Pix ao banco'
        else 'em andamento'
      end;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'pagamentos_lote_sem_concorrente' and not tgisinternal
  ) then
    create trigger pagamentos_lote_sem_concorrente
      before insert on public.pagamentos_lote
      for each row execute function public.pagamentos_barrar_lote_concorrente();
  end if;
end $$;
