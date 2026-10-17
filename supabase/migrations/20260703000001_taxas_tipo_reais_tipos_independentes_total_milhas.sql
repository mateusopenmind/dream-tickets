-- Taxas com tipo R$/milhas + tipos independentes nos Valores Reais + total_milhas incluindo taxas
alter table public.emissoes
  add column if not exists taxas_tipo text not null default 'reais' check (taxas_tipo in ('reais','milhas')),
  add column if not exists taxas_real_tipo text not null default 'reais' check (taxas_real_tipo in ('reais','milhas')),
  add column if not exists bagagens_real_tipo text not null default 'reais' check (bagagens_real_tipo in ('reais','milhas')),
  add column if not exists assentos_real_tipo text not null default 'reais' check (assentos_real_tipo in ('reais','milhas'));

-- Emissões existentes: reais herdam o tipo escolhido nos cobrados
update public.emissoes set bagagens_real_tipo = bagagens_tipo, assentos_real_tipo = assentos_tipo;

-- Recriar total_milhas (coluna gerada não pode ser alterada) incluindo Taxas em milhas
alter table public.emissoes drop column if exists total_milhas;
alter table public.emissoes
  add column total_milhas numeric generated always as (
    coalesce(milhas_cobrado, 0)
    + case when taxas_tipo = 'milhas' then coalesce(taxas_cobrado, 0) else 0 end
    + case when bagagens_tipo = 'milhas' then coalesce(bagagens_cobrado, 0) else 0 end
    + case when assentos_tipo = 'milhas' then coalesce(assentos_cobrado, 0) else 0 end
  ) stored;

comment on column public.emissoes.total_milhas is 'Soma automática: milhas_cobrado + taxas/bagagens/assentos cobrados quando informados em milhas';
