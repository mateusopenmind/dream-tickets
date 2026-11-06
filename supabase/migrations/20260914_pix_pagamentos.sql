-- Pix Pagamentos (saida de dinheiro) — lote, itens e codigo de aprovacao.
-- Criado em 14/09/2026. Ver outros/INTEGRACAO_SICOOB_PIX_PAGAMENTOS.md
--
-- SEGURANCA: o cliente (authenticated) SO LE. Nenhuma policy de INSERT/UPDATE/DELETE
-- para lote e itens: toda transicao de estado passa pela edge function ou pelo n8n,
-- que usam service role e ignoram RLS. A tabela de codigos nao tem policy nenhuma —
-- ninguem logado le o hash do codigo de aprovacao.

create table if not exists pagamentos_lote (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('facial','fornecedor','reembolso')),
  status text not null default 'PREPARANDO'
    check (status in ('PREPARANDO','AGUARDANDO_CONFERENCIA','AGUARDANDO_APROVACAO',
                      'APROVADO','EXECUTANDO','CONCLUIDO','PARCIAL','CANCELADO','EXPIRADO')),
  qtd_itens integer not null default 0,
  valor_total numeric(14,2) not null default 0,
  exige_codigo boolean not null default false,   -- true quando valor_total > teto
  teto_aplicado numeric(14,2),                   -- teto vigente quando o lote nasceu
  assinatura text,                               -- hash do conteudo; amarra o codigo a ESTE lote
  solicitado_por uuid default auth.uid(),
  solicitado_em timestamptz not null default now(),
  conferido_em timestamptz,                      -- passou pela tela Conferencia Pix
  aprovado_por uuid,
  aprovado_em timestamptz,
  expira_em timestamptz not null default (now() + interval '30 minutes'),
  erro text,
  owner_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists pagamentos_lote_itens (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references pagamentos_lote(id) on delete cascade,
  origem_tabela text not null check (origem_tabela in ('emissoes','emissoes_terceirizadas','reembolsos')),
  origem_id uuid not null,
  referencia text,              -- id_emissao / reembolso_id, para exibir
  localizador text,
  chave_pix text not null,
  valor numeric(14,2) not null check (valor > 0),
  descricao text,               -- vai junto do Pix, aparece no extrato de quem recebe
  end_to_end_id text,           -- devolvido pelo POST /pagamentos (iniciacao)
  titular_nome text,            -- quem o DICT diz que e o dono da chave
  titular_documento text,
  nome_cadastro text,           -- o que o nosso cadastro diz
  divergencia_nome boolean not null default false,
  estado text not null default 'PENDENTE'
    check (estado in ('PENDENTE','INICIADO','ERRO_INICIACAO','CONFIRMADO',
                      'FINALIZADO_SUCESSO','FINALIZADO_REJEICAO','CANCELADO')),
  erro text,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trava de pagamento em duplicidade NO BANCO: a mesma origem nao pode estar em dois
-- lotes vivos ao mesmo tempo. Se a aplicacao falhar, o banco ainda recusa.
create unique index if not exists ux_pagamentos_item_origem_viva
  on pagamentos_lote_itens (origem_tabela, origem_id)
  where estado in ('PENDENTE','INICIADO','CONFIRMADO','FINALIZADO_SUCESSO');

create unique index if not exists ux_pagamentos_item_e2e
  on pagamentos_lote_itens (end_to_end_id) where end_to_end_id is not null;

create index if not exists ix_pagamentos_item_lote on pagamentos_lote_itens (lote_id);
create index if not exists ix_pagamentos_lote_status on pagamentos_lote (status);

create table if not exists pagamentos_codigo (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references pagamentos_lote(id) on delete cascade,
  codigo_hash text not null,
  assinatura text not null,     -- tem que bater com pagamentos_lote.assinatura
  enviado_para text,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '10 minutes'),
  usado_em timestamptz,
  tentativas integer not null default 0
);
create index if not exists ix_pagamentos_codigo_lote on pagamentos_codigo (lote_id);

alter table pagamentos_lote        enable row level security;
alter table pagamentos_lote_itens  enable row level security;
alter table pagamentos_codigo      enable row level security;

drop policy if exists pagamentos_lote_sel on pagamentos_lote;
create policy pagamentos_lote_sel on pagamentos_lote for select to authenticated
  using ((owner_id = (select auth.uid())) or (select is_admin()) or (select is_delete_admin()));

drop policy if exists pagamentos_lote_itens_sel on pagamentos_lote_itens;
create policy pagamentos_lote_itens_sel on pagamentos_lote_itens for select to authenticated
  using (exists (select 1 from pagamentos_lote l where l.id = lote_id
                 and ((l.owner_id = (select auth.uid())) or (select is_admin()) or (select is_delete_admin()))));

-- pagamentos_codigo: SEM policy. RLS ligada e nenhuma policy = ninguem logado le nem escreve.

drop trigger if exists trg_pagamentos_lote_updated on pagamentos_lote;
create trigger trg_pagamentos_lote_updated before update on pagamentos_lote
  for each row execute function set_updated_at();

drop trigger if exists trg_pagamentos_lote_itens_updated on pagamentos_lote_itens;
create trigger trg_pagamentos_lote_itens_updated before update on pagamentos_lote_itens
  for each row execute function set_updated_at();

drop trigger if exists trg_pagamentos_lote_audit on pagamentos_lote;
create trigger trg_pagamentos_lote_audit before insert or update on pagamentos_lote
  for each row execute function set_audit_fields();
