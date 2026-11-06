-- Bagagens/Assentos: tipo do valor (R$ ou milhas), campos nos Valores Reais e Total Milhas
alter table public.emissoes
  add column if not exists bagagens_tipo text not null default 'reais' check (bagagens_tipo in ('reais','milhas')),
  add column if not exists assentos_tipo text not null default 'reais' check (assentos_tipo in ('reais','milhas')),
  add column if not exists bagagens_real numeric not null default 0,
  add column if not exists assentos_real numeric not null default 0,
  add column if not exists total_milhas numeric generated always as (
    coalesce(milhas_cobrado, 0)
    + case when bagagens_tipo = 'milhas' then coalesce(bagagens_cobrado, 0) else 0 end
    + case when assentos_tipo = 'milhas' then coalesce(assentos_cobrado, 0) else 0 end
  ) stored;

comment on column public.emissoes.total_milhas is 'Soma automática: milhas_cobrado + bagagens_cobrado (se em milhas) + assentos_cobrado (se em milhas)';
