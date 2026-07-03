-- Realtime para avisar Pix pago/cancelado na tela do app
alter table public.emissoes replica identity full;
alter publication supabase_realtime add table public.emissoes;
