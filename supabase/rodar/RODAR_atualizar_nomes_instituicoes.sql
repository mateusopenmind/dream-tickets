-- Atualiza o nome da instituição nos Pix que ficaram como "ISPB xxxxxxxx".
-- Rode sempre que cadastrar ISPBs novos em pix_instituicoes. Pode rodar quantas vezes quiser.
--
-- 1) (opcional) cadastre os ISPBs que faltam, por exemplo:
--    insert into public.pix_instituicoes (ispb, nome) values ('03566655', 'NOME DA INSTITUICAO')
--    on conflict (ispb) do update set nome = excluded.nome;
--
-- 2) Atualiza os registros. Os gatilhos ficam desligados só durante o update, para não disparar
--    auditoria, valor facial e regras de reembolso em registros antigos.
begin;
do $$
declare t text;
begin
  foreach t in array array['emissoes','emissoes_terceirizadas','reembolsos','cobrancas_agrupadas'] loop
    execute format('alter table public.%I disable trigger user', t);
    execute format('update public.%I set pagador_instituicao = public.pix_nome_instituicao(pagador_ispb)
                     where pagador_ispb is not null
                       and pagador_instituicao is distinct from public.pix_nome_instituicao(pagador_ispb)', t);
    execute format('alter table public.%I enable trigger user', t);
  end loop;
end $$;
update public.pagamentos_lote_itens set recebedor_instituicao = public.pix_nome_instituicao(recebedor_ispb)
 where recebedor_ispb is not null
   and recebedor_instituicao is distinct from public.pix_nome_instituicao(recebedor_ispb);
commit;

-- Conferência: ISPBs que ainda estão sem nome
select pagador_ispb as ispb, count(*) as qtd
  from (select pagador_ispb, pagador_instituicao from public.emissoes
        union all select pagador_ispb, pagador_instituicao from public.emissoes_terceirizadas
        union all select pagador_ispb, pagador_instituicao from public.reembolsos) x
 where pagador_instituicao like 'ISPB %'
 group by 1 order by 2 desc;
