-- ID visível "P000001" para os movimentos de Assinatura e Bônus de clube (sequência única dos dois).
-- Gerado só quando o movimento é CONFIRMADO (previsões são apagadas/recriadas a cada salvamento
-- da assinatura, então não recebem código). Devolver para a Conferência mantém o código.
alter table public.estoque_movimentos add column if not exists id_movimento text;
create unique index if not exists uq_estoque_movimentos_id_movimento
  on public.estoque_movimentos (id_movimento) where id_movimento is not null;

create or replace function public.gerar_id_movimento_clube()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_seq int;
begin
  if new.id_movimento is not null and new.id_movimento <> '' then return new; end if;
  if new.tipo not in ('assinatura', 'bonus') or coalesce(new.confirmado, false) = false then return new; end if;
  perform pg_advisory_xact_lock(hashtext('estoque_movimentos.id_movimento.P'));
  select coalesce(max((substr(id_movimento, 2))::int), 0) + 1 into v_seq
    from estoque_movimentos where id_movimento ~ '^P[0-9]+$';
  new.id_movimento := 'P' || lpad(v_seq::text, 6, '0');
  return new;
end; $$;


create trigger trg_gerar_id_movimento_clube
  before insert or update on public.estoque_movimentos
  for each row execute function public.gerar_id_movimento_clube();

-- Backfill: confirmados já existentes, na ordem cronológica (assinatura antes do bônus no mesmo instante).
with ord as (
  select id, row_number() over (order by data, hora nulls first, case tipo when 'assinatura' then 0 else 1 end, created_at, id) rn
  from public.estoque_movimentos
  where tipo in ('assinatura', 'bonus') and confirmado and id_movimento is null
)
update public.estoque_movimentos m set id_movimento = 'P' || lpad(ord.rn::text, 6, '0')
from ord where ord.id = m.id;
