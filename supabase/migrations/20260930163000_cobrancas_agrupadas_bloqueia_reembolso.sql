-- Reembolso de emissão que está numa cobrança agrupada EM ABERTO: bloqueia na criação.
-- Sem isso o reembolso nasceria, o cancelamento do Pix da emissão falharia (o Pix é o do grupo)
-- e o cliente continuaria pagando a emissão reembolsada dentro do Pix do grupo.
create or replace function public.guard_reembolso_emissao_agrupada()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_grupo uuid; v_codigo text;
begin
  if new.emissao_id is null then return new; end if;
  if coalesce(new.tabela_origem, 'emissoes') = 'emissoes_terceirizadas' then
    select cobranca_agrupada_id into v_grupo from emissoes_terceirizadas where id = new.emissao_id;
  else
    select cobranca_agrupada_id into v_grupo from emissoes where id = new.emissao_id;
  end if;
  if v_grupo is null then return new; end if;
  select codigo into v_codigo from cobrancas_agrupadas where id = v_grupo and status_pix in ('GERANDO', 'EM ABERTO');
  if v_codigo is not null then
    raise exception 'A emissão está na cobrança agrupada % (em aberto). Desagrupe em Cobranças em Aberto antes de lançar o reembolso.', v_codigo using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.guard_reembolso_emissao_agrupada() from public, anon, authenticated;
drop trigger if exists trg_guard_reembolso_emissao_agrupada on public.reembolsos;
create trigger trg_guard_reembolso_emissao_agrupada before insert on public.reembolsos
  for each row execute function public.guard_reembolso_emissao_agrupada();
