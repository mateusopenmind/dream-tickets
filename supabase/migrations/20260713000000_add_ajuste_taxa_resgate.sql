-- Ajuste "Taxa de Resgate" (Reais != Cobrados) — visível apenas para o programa Azul Liminar.
-- Aplicado nas duas modalidades de emissão (própria e terceirizada).
alter table public.emissoes
  add column if not exists ajuste_taxa_resgate boolean not null default false;

alter table public.emissoes_terceirizadas
  add column if not exists ajuste_taxa_resgate boolean not null default false;

comment on column public.emissoes.ajuste_taxa_resgate is 'Ajuste (Reais != Cobrados): Taxa de Resgate. Visivel apenas para programa Azul Liminar.';
comment on column public.emissoes_terceirizadas.ajuste_taxa_resgate is 'Ajuste (Reais != Cobrados): Taxa de Resgate. Visivel apenas para programa Azul Liminar.';
