-- Renomeia a funcionalidade "Pagamentos Avulsos" para "Recebimentos Avulsos" (nome mais correto:
-- são recebimentos lançados manualmente pelo cliente, não pagamentos a terceiros). Mantém o mesmo
-- tela_id em `telas` para não precisar re-liberar o acesso já concedido ao admin.

ALTER TABLE public.pagamentos_avulsos RENAME TO recebimentos_avulsos;

ALTER INDEX public.idx_pagamentos_avulsos_emissao RENAME TO idx_recebimentos_avulsos_emissao;
ALTER INDEX public.idx_pagamentos_avulsos_status RENAME TO idx_recebimentos_avulsos_status;

ALTER TABLE public.recebimentos_avulsos RENAME CONSTRAINT pagamentos_avulsos_cliente_id_fkey TO recebimentos_avulsos_cliente_id_fkey;
ALTER TABLE public.recebimentos_avulsos RENAME CONSTRAINT pagamentos_avulsos_owner_id_fkey TO recebimentos_avulsos_owner_id_fkey;
ALTER TABLE public.recebimentos_avulsos RENAME CONSTRAINT pagamentos_avulsos_pkey TO recebimentos_avulsos_pkey;
ALTER TABLE public.recebimentos_avulsos RENAME CONSTRAINT pagamentos_avulsos_status_check TO recebimentos_avulsos_status_check;
ALTER TABLE public.recebimentos_avulsos RENAME CONSTRAINT pagamentos_avulsos_tabela_origem_check TO recebimentos_avulsos_tabela_origem_check;
ALTER TABLE public.recebimentos_avulsos RENAME CONSTRAINT pagamentos_avulsos_valor_check TO recebimentos_avulsos_valor_check;

ALTER POLICY "pagamentos_avulsos_sel" ON public.recebimentos_avulsos RENAME TO "recebimentos_avulsos_sel";
ALTER POLICY "pagamentos_avulsos_ins" ON public.recebimentos_avulsos RENAME TO "recebimentos_avulsos_ins";
ALTER POLICY "pagamentos_avulsos_upd" ON public.recebimentos_avulsos RENAME TO "recebimentos_avulsos_upd";
ALTER POLICY "pagamentos_avulsos_del" ON public.recebimentos_avulsos RENAME TO "recebimentos_avulsos_del";

ALTER TRIGGER trg_pagamentos_avulsos_updated ON public.recebimentos_avulsos RENAME TO trg_recebimentos_avulsos_updated;
ALTER TRIGGER trg_preencher_pagamento_avulso ON public.recebimentos_avulsos RENAME TO trg_preencher_recebimento_avulso;
ALTER TRIGGER trg_sync_pagamento_avulso ON public.recebimentos_avulsos RENAME TO trg_sync_recebimento_avulso;

-- Função de preenchimento não referenciava a própria tabela no corpo — só renomeia.
ALTER FUNCTION public.preencher_dados_pagamento_avulso() RENAME TO preencher_dados_recebimento_avulso;

-- Função de sincronização referenciava a tabela pelo nome antigo — recria o corpo antes de renomear.
CREATE OR REPLACE FUNCTION public.sync_pagamento_avulso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tabela text := COALESCE(NEW.tabela_origem, OLD.tabela_origem);
  v_emissao_id uuid := COALESCE(NEW.emissao_id, OLD.emissao_id);
  v_soma numeric;
  v_ultima_data date;
  v_total numeric;
  v_status text;
BEGIN
  SELECT COALESCE(SUM(valor), 0), MAX(data_recebimento)
    INTO v_soma, v_ultima_data
    FROM public.recebimentos_avulsos
    WHERE tabela_origem = v_tabela AND emissao_id = v_emissao_id AND status = 'recebido';

  IF v_tabela = 'emissoes' THEN
    SELECT preco_total, status_pix INTO v_total, v_status FROM public.emissoes WHERE id = v_emissao_id;
    IF v_status IS NOT NULL AND v_status <> 'CANCELADO' THEN
      IF v_total IS NOT NULL AND v_total > 0 AND v_soma >= v_total THEN
        UPDATE public.emissoes SET valor_recebido = v_soma, data_recebimento = v_ultima_data::timestamptz, status_pix = 'PAGO' WHERE id = v_emissao_id;
      ELSE
        UPDATE public.emissoes SET valor_recebido = v_soma, status_pix = (CASE WHEN status_pix = 'PAGO' THEN 'EM ABERTO' ELSE status_pix END) WHERE id = v_emissao_id;
      END IF;
    END IF;
  ELSIF v_tabela = 'emissoes_terceirizadas' THEN
    SELECT preco_total, status_pix INTO v_total, v_status FROM public.emissoes_terceirizadas WHERE id = v_emissao_id;
    IF v_status IS NOT NULL AND v_status <> 'CANCELADO' THEN
      IF v_total IS NOT NULL AND v_total > 0 AND v_soma >= v_total THEN
        UPDATE public.emissoes_terceirizadas SET valor_recebido = v_soma, data_recebimento = v_ultima_data::timestamptz, status_pix = 'PAGO' WHERE id = v_emissao_id;
      ELSE
        UPDATE public.emissoes_terceirizadas SET valor_recebido = v_soma, status_pix = (CASE WHEN status_pix = 'PAGO' THEN 'EM ABERTO' ELSE status_pix END) WHERE id = v_emissao_id;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
ALTER FUNCTION public.sync_pagamento_avulso() RENAME TO sync_recebimento_avulso;

-- RPC de resumo (usada para avisar antes de cancelar/excluir a emissão) — idem, recria e renomeia.
CREATE OR REPLACE FUNCTION public.resumo_pagamentos_avulsos(p_tabela_origem text, p_emissao_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'recebidos', COUNT(*) FILTER (WHERE status = 'recebido'),
    'valor_total', COALESCE(SUM(valor), 0),
    'valor_recebido', COALESCE(SUM(valor) FILTER (WHERE status = 'recebido'), 0)
  )
  FROM public.recebimentos_avulsos
  WHERE tabela_origem = p_tabela_origem AND emissao_id = p_emissao_id;
$$;
ALTER FUNCTION public.resumo_pagamentos_avulsos(text, uuid) RENAME TO resumo_recebimentos_avulsos;

-- Tela: renomeia chave/nome mantendo o mesmo id (usuario_telas já concedido ao admin continua valendo)
UPDATE public.telas SET chave = 'recebimentos_avulsos', nome = 'Recebimentos Avulsos' WHERE chave = 'pagamentos_avulsos';
