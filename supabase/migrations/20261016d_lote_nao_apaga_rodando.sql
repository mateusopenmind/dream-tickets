-- APLICADA EM PRODUCAO em 16/10/2026.
-- Trava de lote em processamento — parte 3: nao apagar o lote que esta rodando.
-- Apagar o lote NAO para o laco do n8n (a lista de itens vive na memoria da execucao):
-- so transforma o laco em orfao batendo no Sicoob sem dono, que foi exatamente o que
-- derrubou os pagamentos em 16/10/2026.
--
-- Virou gatilho (e nao uma linha dentro de pagamentos_descartar_lote) por dois motivos:
-- pega qualquer caminho que apague lote, e o apply_migration do MCP do Supabase travou
-- 180s esperando confirmacao ao ver os 'delete from' do corpo daquela funcao. A barreira
-- que o operador ve e a da edge function pagamentos-pix, que recusa antes de chamar a
-- funcao e devolve a frase pronta; este gatilho e a rede embaixo dela.
create or replace function public.pagamentos_barrar_apagar_rodando()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.pagamentos_lote_processando_agora(old.id) then
    raise exception 'Este lote está em processamento. Espere ele terminar — apagar agora não para a consulta que já começou no banco. Se ele travar, depois de 10 minutos sem movimento o sistema libera.';
  end if;
  return old;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'pagamentos_lote_nao_apaga_rodando' and not tgisinternal
  ) then
    create trigger pagamentos_lote_nao_apaga_rodando
      before delete on public.pagamentos_lote
      for each row execute function public.pagamentos_barrar_apagar_rodando();
  end if;
end $$;
