
CREATE OR REPLACE FUNCTION public.import_emissao(
  p_data_emissao date,
  p_hora time,
  p_localizador text,
  p_programa text,
  p_nome_operacao text,
  p_data_voo_ida date,
  p_emissor text,
  p_conta_codigo text,
  p_cliente_codigo text,
  p_cartao_codigo text,
  p_passageiros_qtd integer,
  p_milhas_cobrado numeric,
  p_preco_milheiro numeric,
  p_taxas_cobrado numeric,
  p_outros_cobrado numeric,
  p_preco_total numeric,
  p_milhas_real numeric,
  p_taxas_real numeric,
  p_outros_real numeric,
  p_origem_venda text,
  p_observacao text,
  p_pagar_facial text,
  p_data_pagto_facial date,
  p_status_pix text,
  p_data_recebimento timestamptz,
  p_valor_recebido numeric,
  p_obs_pix text,
  p_txid text,
  p_id_externo text,
  p_reprocessar boolean,
  p_codigo_la text,
  p_percentual_cb numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO emissoes (data_emissao, hora, localizador, programa, nome_operacao, data_voo_ida, emissor, conta_id, cliente_id, cartao_id, passageiros_qtd, milhas_cobrado, preco_milheiro, taxas_cobrado, outros_cobrado, preco_total, milhas_real, taxas_real, outros_real, origem_venda, observacao, pagar_facial, data_pagto_facial, status_pix, data_recebimento, valor_recebido, obs_pix, txid, id_externo, reprocessar, codigo_la, percentual_cb)
  VALUES (
    p_data_emissao, p_hora, p_localizador, p_programa, p_nome_operacao, p_data_voo_ida, p_emissor,
    (SELECT id FROM contas WHERE codigo = p_conta_codigo LIMIT 1),
    (SELECT id FROM clientes WHERE codigo = p_cliente_codigo LIMIT 1),
    (SELECT id FROM cartoes WHERE codigo = p_cartao_codigo LIMIT 1),
    p_passageiros_qtd, p_milhas_cobrado, p_preco_milheiro, p_taxas_cobrado, p_outros_cobrado, p_preco_total,
    p_milhas_real, p_taxas_real, p_outros_real, p_origem_venda, p_observacao, p_pagar_facial, p_data_pagto_facial,
    p_status_pix, p_data_recebimento, p_valor_recebido, p_obs_pix, p_txid, p_id_externo, p_reprocessar, p_codigo_la, p_percentual_cb
  )
  ON CONFLICT (id_externo) DO NOTHING;
END;
$$;
