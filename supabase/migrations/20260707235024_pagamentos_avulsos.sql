-- Pagamentos avulsos de clientes: lançamento manual de recebíveis (parcelas previstas/recebidas)
-- vinculados a UMA emissão (normal ou terceirizada). Quando a soma dos recebidos bate o preco_total,
-- a emissão é marcada automaticamente como PAGO (mesmo mecanismo de status_pix usado pelo Pix).
CREATE TABLE public.pagamentos_avulsos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela_origem text NOT NULL CHECK (tabela_origem IN ('emissoes','emissoes_terceirizadas')),
  emissao_id uuid NOT NULL,
  id_emissao text,
  cliente_id uuid REFERENCES public.clientes(id),
  numero_parcela integer NOT NULL DEFAULT 1,
  total_parcelas integer NOT NULL DEFAULT 1,
  data_prevista date,
  data_recebimento date,
  banco text,
  valor numeric NOT NULL DEFAULT 0 CHECK (valor >= 0),
  status text NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','recebido')),
  observacao text,
  owner_id uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pagamentos_avulsos_emissao ON public.pagamentos_avulsos (tabela_origem, emissao_id);
CREATE INDEX idx_pagamentos_avulsos_status ON public.pagamentos_avulsos (status);

ALTER TABLE public.pagamentos_avulsos ENABLE ROW LEVEL SECURITY;

-- Acesso restrito a admin/super_admin (tela liberada só para admin, nunca operador)
CREATE POLICY "pagamentos_avulsos_sel" ON public.pagamentos_avulsos FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "pagamentos_avulsos_ins" ON public.pagamentos_avulsos FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "pagamentos_avulsos_upd" ON public.pagamentos_avulsos FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "pagamentos_avulsos_del" ON public.pagamentos_avulsos FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER trg_pagamentos_avulsos_updated BEFORE UPDATE ON public.pagamentos_avulsos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Preenche id_emissao/cliente_id a partir da emissão de origem (não confia no valor enviado pelo cliente)
CREATE OR REPLACE FUNCTION public.preencher_dados_pagamento_avulso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tabela_origem = 'emissoes' THEN
    SELECT id_emissao, cliente_id INTO NEW.id_emissao, NEW.cliente_id FROM public.emissoes WHERE id = NEW.emissao_id;
  ELSIF NEW.tabela_origem = 'emissoes_terceirizadas' THEN
    SELECT id_emissao, cliente_id INTO NEW.id_emissao, NEW.cliente_id FROM public.emissoes_terceirizadas WHERE id = NEW.emissao_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_preencher_pagamento_avulso BEFORE INSERT ON public.pagamentos_avulsos
  FOR EACH ROW EXECUTE FUNCTION public.preencher_dados_pagamento_avulso();

-- Recalcula valor_recebido/status_pix da emissão vinculada sempre que um pagamento avulso é
-- inserido, atualizado (ex.: marcado como recebido) ou excluído.
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
    FROM public.pagamentos_avulsos
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

CREATE TRIGGER trg_sync_pagamento_avulso
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_avulsos
FOR EACH ROW EXECUTE FUNCTION public.sync_pagamento_avulso();
