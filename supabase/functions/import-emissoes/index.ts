import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify API key
    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { emissoes } = await req.json();

    if (!Array.isArray(emissoes) || emissoes.length === 0) {
      return new Response(JSON.stringify({ error: "No data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load lookup maps
    const [clientesRes, contasRes, cartoesRes] = await Promise.all([
      supabase.from("clientes").select("id, codigo"),
      supabase.from("contas").select("id, codigo"),
      supabase.from("cartoes").select("id, codigo"),
    ]);

    const clienteMap = new Map((clientesRes.data || []).map((c: any) => [c.codigo, c.id]));
    const contaMap = new Map((contasRes.data || []).map((c: any) => [c.codigo, c.id]));
    const cartaoMap = new Map((cartoesRes.data || []).map((c: any) => [c.codigo, c.id]));

    const results = { inserted: 0, skipped: 0, errors: [] as string[] };

    // Process in batches of 50
    for (let i = 0; i < emissoes.length; i += 50) {
      const batch = emissoes.slice(i, i + 50);
      const rows = batch.map((e: any) => ({
        data_emissao: e.data_emissao,
        hora: e.hora || null,
        localizador: e.localizador,
        programa: e.programa || null,
        nome_operacao: e.nome_operacao || null,
        data_voo_ida: e.data_voo_ida || null,
        emissor: e.emissor || null,
        conta_id: contaMap.get(e.conta_codigo) || null,
        cliente_id: clienteMap.get(e.cliente_codigo) || null,
        cartao_id: cartaoMap.get(e.forma_pagamento) || null,
        passageiros_qtd: e.passageiros_qtd || 1,
        milhas_cobrado: e.milhas_cobrado || 0,
        preco_milheiro: e.preco_milheiro || 0,
        taxas_cobrado: e.taxas_cobrado || 0,
        outros_cobrado: e.outros_cobrado || 0,
        preco_total: e.preco_total || 0,
        milhas_real: e.milhas_real || 0,
        taxas_real: e.taxas_real || 0,
        outros_real: e.outros_real || 0,
        codigo_la: e.codigo_la || null,
        percentual_cb: e.percentual_cb || null,
        origem_venda: e.origem_venda || null,
        observacao: e.observacao || null,
        pagar_facial: e.pagar_facial || null,
        data_pagto_facial: e.data_pagto_facial || null,
        status_pix: e.status_pix || "EM ABERTO",
        data_recebimento: e.data_recebimento || null,
        valor_recebido: e.valor_recebido || 0,
        obs_pix: e.obs_pix || null,
        txid: e.txid || null,
        id_externo: e.id_externo || null,
        reprocessar: e.reprocessar || false,
        cancelar: e.cancelar || false,
      }));

      const { data, error } = await supabase
        .from("emissoes")
        .upsert(rows, { onConflict: "id_externo", ignoreDuplicates: true });

      if (error) {
        results.errors.push(`Batch ${i}: ${error.message}`);
      } else {
        results.inserted += rows.length;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
