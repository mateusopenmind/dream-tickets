CREATE OR REPLACE FUNCTION public.sync_recebimento_avulso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tabela text := COALESCE(NEW.tabela_origem, OLD.tabela_origem);
  v_emissao_id uuid := COALESCE(NEW.emissao_id, OLD.emissao_id);
  v_soma numeric;
  v_ultima_data date;
  v_total numeric;
  v_status text;
  v_qtd int;
  v_linhas text;
  v_obs text;
BEGIN
  -- Soma apenas as parcelas já recebidas (usada para decidir PAGO e valor_recebido)
  SELECT COALESCE(SUM(valor), 0), MAX(data_recebimento)
    INTO v_soma, v_ultima_data
    FROM public.recebimentos_avulsos
    WHERE tabela_origem = v_tabela AND emissao_id = v_emissao_id AND status = 'recebido';

  -- Conta TODAS as parcelas (previstas + recebidas) para montar o resumo em observação
  SELECT COUNT(*) INTO v_qtd
    FROM public.recebimentos_avulsos
    WHERE tabela_origem = v_tabela AND emissao_id = v_emissao_id;

  IF v_qtd > 0 THEN
    SELECT string_agg(
      format('%s/%s - %s - R$ %s - %s%s',
        numero_parcela, total_parcelas,
        to_char(COALESCE(data_recebimento, data_prevista), 'DD/MM/YYYY'),
        to_char(valor, 'FM999G999G990D00'),
        upper(status),
        CASE WHEN status = 'recebido' AND banco IS NOT NULL AND banco <> '' THEN ' (' || banco || ')' ELSE '' END
      ), chr(10) ORDER BY numero_parcela
    ) INTO v_linhas
    FROM public.recebimentos_avulsos
    WHERE tabela_origem = v_tabela AND emissao_id = v_emissao_id;
    v_obs := 'Recebimento avulso — ' || v_qtd || ' parcela(s):' || chr(10) || v_linhas;
  ELSE
    v_obs := NULL;
  END IF;

  IF v_tabela = 'emissoes' THEN
    SELECT preco_total, status_pix INTO v_total, v_status FROM public.emissoes WHERE id = v_emissao_id;
    IF v_status IS NOT NULL AND v_status <> 'CANCELADO' THEN
      IF v_total IS NOT NULL AND v_total > 0 AND v_soma >= v_total THEN
        UPDATE public.emissoes SET
          valor_recebido = v_soma,
          data_recebimento = v_ultima_data::timestamptz,
          status_pix = 'PAGO',
          forma_cobranca = 'avulso',
          obs_pix = v_obs
        WHERE id = v_emissao_id;
      ELSE
        UPDATE public.emissoes SET
          valor_recebido = v_soma,
          status_pix = (CASE WHEN status_pix = 'PAGO' THEN 'EM ABERTO' ELSE status_pix END),
          forma_cobranca = (CASE WHEN v_qtd > 0 THEN 'avulso' WHEN forma_cobranca = 'avulso' THEN NULL ELSE forma_cobranca END),
          obs_pix = (CASE WHEN v_qtd > 0 THEN v_obs WHEN forma_cobranca = 'avulso' THEN NULL ELSE obs_pix END)
        WHERE id = v_emissao_id;
      END IF;
    END IF;
  ELSIF v_tabela = 'emissoes_terceirizadas' THEN
    SELECT preco_total, status_pix INTO v_total, v_status FROM public.emissoes_terceirizadas WHERE id = v_emissao_id;
    IF v_status IS NOT NULL AND v_status <> 'CANCELADO' THEN
      IF v_total IS NOT NULL AND v_total > 0 AND v_soma >= v_total THEN
        UPDATE public.emissoes_terceirizadas SET
          valor_recebido = v_soma,
          data_recebimento = v_ultima_data::timestamptz,
          status_pix = 'PAGO',
          forma_cobranca = 'avulso',
          obs_pix = v_obs
        WHERE id = v_emissao_id;
      ELSE
        UPDATE public.emissoes_terceirizadas SET
          valor_recebido = v_soma,
          status_pix = (CASE WHEN status_pix = 'PAGO' THEN 'EM ABERTO' ELSE status_pix END),
          forma_cobranca = (CASE WHEN v_qtd > 0 THEN 'avulso' WHEN forma_cobranca = 'avulso' THEN NULL ELSE forma_cobranca END),
          obs_pix = (CASE WHEN v_qtd > 0 THEN v_obs WHEN forma_cobranca = 'avulso' THEN NULL ELSE obs_pix END)
        WHERE id = v_emissao_id;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
