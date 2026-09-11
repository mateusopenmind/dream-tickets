-- Novos campos em Valores Cobrados: Bagagens e Assentos (somam no Preço Total)
alter table public.emissoes
  add column if not exists bagagens_cobrado numeric not null default 0,
  add column if not exists assentos_cobrado numeric not null default 0;
