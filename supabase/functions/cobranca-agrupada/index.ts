import { createClient } from "jsr:@supabase/supabase-js@2";

// Cobrança agrupada (30/09/2026) — um Pix só para várias cobranças EM ABERTO do mesmo cliente.
//
// acao = "agrupar"    { itens: [{ tabela, id }, ...] }
//        -> RPC criar_cobranca_agrupada (com o JWT do usuário: valida permissão, cliente,
//           status e trava os itens) e depois o n8n "Pix Agrupamento", que confere no banco se
//           nenhum Pix individual foi pago, cancela os individuais, gera o Pix do grupo pelo
//           ROUTER (Sicoob -> Sicredi) e manda o WhatsApp.
// acao = "desagrupar" { grupo_id } -> n8n cancela o Pix do grupo, solta os itens e gera de novo
//                                    o Pix individual de cada um (com WhatsApp).
// acao = "reenviar"   { grupo_id } -> n8n reenvia o WhatsApp do Pix do grupo.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

const WEBHOOK = Deno.env.get("N8N_WEBHOOK_AGRUPAMENTO") || "https://n8n.openmindia.com/webhook/pix-agrupamento";
const TABELAS = new Set(["emissoes", "emissoes_terceirizadas", "reembolsos"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });

  const { data: u } = await caller.auth.getUser();
  if (!u?.user) return json({ error: "Não autenticado" }, 401);
  const { data: perfil } = await admin.from("perfis_usuario").select("papel,ativo,whatsapp,nome").eq("id", u.user.id).single();
  if (!perfil?.ativo) return json({ error: "Perfil inativo" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const acao = String(body.acao || "").toLowerCase();
  const fone = String(body.fone_destino || perfil.whatsapp || "");

  const temPermissao = async () => {
    if (perfil.papel === "super_admin") return true;
    const { data } = await admin
      .from("usuario_telas")
      .select("tela_id, telas!inner(chave)")
      .eq("usuario_id", u.user!.id)
      .eq("telas.chave", "cobrancas_agrupar")
      .limit(1);
    return !!data?.length;
  };

  let grupoId = "";
  let codigo = "";

  if (acao === "agrupar") {
    const itens = Array.isArray(body.itens) ? body.itens : [];
    const limpos = itens
      .filter((i: any) => i && TABELAS.has(String(i.tabela)) && typeof i.id === "string")
      .map((i: any) => ({ tabela: String(i.tabela), id: String(i.id) }));
    if (limpos.length !== itens.length || limpos.length < 2) {
      return json({ error: "Selecione pelo menos 2 cobranças válidas para agrupar." }, 400);
    }
    // A RPC roda com o JWT do usuário: ela confere permissão, dono, cliente e status.
    const { data, error } = await caller.rpc("criar_cobranca_agrupada", { p_itens: limpos, p_fone: fone });
    if (error) return json({ error: error.message }, 400);
    grupoId = (data as any)?.id;
    codigo = (data as any)?.codigo;
    if (!grupoId) return json({ error: "Não foi possível criar o agrupamento." }, 500);
  } else if (acao === "desagrupar" || acao === "reenviar") {
    grupoId = String(body.grupo_id || "");
    if (!grupoId) return json({ error: "grupo_id obrigatório" }, 400);
    // Leitura com o JWT do usuário: RLS garante que ele enxerga o grupo.
    const { data: g } = await caller
      .from("cobrancas_agrupadas")
      .select("id, codigo, status_pix, pix_copia_cola")
      .eq("id", grupoId)
      .maybeSingle();
    if (!g) return json({ error: "Agrupamento não encontrado." }, 404);
    codigo = (g as any).codigo;
    const st = String((g as any).status_pix || "");
    if (acao === "desagrupar") {
      if (!(await temPermissao())) return json({ error: "Você não tem permissão para desagrupar cobranças." }, 403);
      if (st !== "EM ABERTO" && st !== "GERANDO") return json({ error: `O agrupamento ${codigo} está ${st} e não pode ser desagrupado.` }, 400);
    } else if (st !== "EM ABERTO" || !(g as any).pix_copia_cola) {
      return json({ error: `O agrupamento ${codigo} não tem Pix em aberto para reenviar.` }, 400);
    }
  } else {
    return json({ error: "Ação inválida (use agrupar, desagrupar ou reenviar)" }, 400);
  }

  try {
    const r = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao, grupo_id: grupoId, fone_destino: fone, usuario: perfil.nome }),
      signal: AbortSignal.timeout(140000),
    });
    const txt = await r.text();
    let resp: any = null;
    try { resp = JSON.parse(txt); } catch { /* */ }
    if (!r.ok || !resp) {
      const aviso = acao === "agrupar"
        ? ` O agrupamento ${codigo} pode ter ficado em geração — confira em Cobranças em Aberto e, se precisar, use Desagrupar em alguns minutos.`
        : "";
      return json({ error: `Falha no processamento (n8n ${r.status}).${aviso}`, grupo_id: grupoId, codigo }, 502);
    }
    return json({ ...resp, grupo_id: grupoId, codigo: resp.codigo || codigo });
  } catch (e) {
    return json({ error: `Falha ao chamar o n8n: ${(e as Error).message}`, grupo_id: grupoId, codigo }, 502);
  }
});
