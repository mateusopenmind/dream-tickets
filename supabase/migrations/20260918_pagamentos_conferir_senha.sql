-- Reautenticacao da aprovacao de pagamento (18/09/2026).
--
-- POR QUE ISTO EXISTE: a edge function conferia a senha chamando signInWithPassword,
-- como se fosse um login novo. So que o login do app tem captcha (Turnstile) ligado no
-- Supabase, e captcha nao existe do lado do servidor — o Supabase recusava, e a funcao
-- traduzia a recusa como "Senha incorreta". Com a senha certa, tambem falhava.
--
-- Aqui a senha e conferida direto contra o hash bcrypt do proprio Supabase, sem passar
-- pelo fluxo de login. Nao afrouxa nada: quem chega aqui ja esta autenticado, ja tem a
-- tela de Conferencia, e a trava de tentativas abaixo segura forca bruta.

create table if not exists public.pagamentos_tentativa_senha (
  usuario_id     uuid primary key,
  tentativas     integer not null default 0,
  janela_inicio  timestamptz not null default now(),
  bloqueado_ate  timestamptz
);

alter table public.pagamentos_tentativa_senha enable row level security;
-- Sem policy nenhuma de proposito: ninguem le nem escreve pelo navegador.

create or replace function public.pagamentos_conferir_senha(
  p_usuario uuid,
  p_senha text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'auth'
as $$
declare
  v_hash    text;
  v_reg     pagamentos_tentativa_senha%rowtype;
  v_ok      boolean;
  c_max     constant integer := 5;
  c_janela  constant interval := interval '15 minutes';
  c_castigo constant interval := interval '15 minutes';
begin
  if p_usuario is null or coalesce(btrim(p_senha),'') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'senha_vazia');
  end if;

  select * into v_reg from pagamentos_tentativa_senha where usuario_id = p_usuario;

  if found and v_reg.bloqueado_ate is not null and v_reg.bloqueado_ate > now() then
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado',
                              'bloqueado_ate', v_reg.bloqueado_ate);
  end if;

  select encrypted_password into v_hash from auth.users where id = p_usuario;
  if v_hash is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_senha');
  end if;

  v_ok := (extensions.crypt(p_senha, v_hash) = v_hash);

  if v_ok then
    delete from pagamentos_tentativa_senha where usuario_id = p_usuario;
    return jsonb_build_object('ok', true);
  end if;

  -- Errou: conta a tentativa dentro da janela e bloqueia ao estourar o limite.
  insert into pagamentos_tentativa_senha (usuario_id, tentativas, janela_inicio)
  values (p_usuario, 1, now())
  on conflict (usuario_id) do update
  set tentativas = case when pagamentos_tentativa_senha.janela_inicio < now() - c_janela
                        then 1 else pagamentos_tentativa_senha.tentativas + 1 end,
      janela_inicio = case when pagamentos_tentativa_senha.janela_inicio < now() - c_janela
                           then now() else pagamentos_tentativa_senha.janela_inicio end
  returning * into v_reg;

  if v_reg.tentativas >= c_max then
    update pagamentos_tentativa_senha
    set bloqueado_ate = now() + c_castigo
    where usuario_id = p_usuario
    returning * into v_reg;
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado',
                              'bloqueado_ate', v_reg.bloqueado_ate);
  end if;

  return jsonb_build_object('ok', false, 'motivo', 'senha_errada',
                            'restantes', c_max - v_reg.tentativas);
end;
$$;

revoke all on function public.pagamentos_conferir_senha(uuid, text) from public;
grant execute on function public.pagamentos_conferir_senha(uuid, text) to service_role;

comment on function public.pagamentos_conferir_senha(uuid, text) is
  'Confere a senha do usuario contra o hash do Supabase, para reautenticar a aprovacao de pagamento. Nao usa o fluxo de login (que tem captcha). 5 erros em 15 min bloqueiam por 15 min. So service_role executa.';
