import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

// 2FA obrigatório (06/11/2026): só aceita sessão confirmada com o código do autenticador
// (claim aal = "aal2"). O verify_jwt do gateway já validou a assinatura do token.
function aalDoHeader(h: string): string | null {
  try {
    const p = h.replace(/^Bearer\s+/i, "").split(".")[1];
    const b = p.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b + "=".repeat((4 - (b.length % 4)) % 4)))?.aal ?? null;
  } catch {
    return null;
  }
}

const WEBHOOK_ENV: Record<string, string> = {
  cobrar: "N8N_WEBHOOK_COBRAR",
  reprocessar: "N8N_WEBHOOK_REPROCESSAR",
  cancelar: "N8N_WEBHOOK_CANCELAR",
  reenviar: "N8N_WEBHOOK_REENVIAR",
  reembolso_resumo: "N8N_WEBHOOK_REEMBOLSO_RESUMO",
};

const WEBHOOK_FORMA_ENV: Record<string, string> = {
  pix: "N8N_WEBHOOK_COBRAR_PIX",
  cartao: "N8N_WEBHOOK_COBRAR_CARTAO",
  link: "N8N_WEBHOOK_COBRAR_LINK",
};

const WEBHOOK_FALLBACK: Record<string, string> = {
  reembolso_resumo: "https://n8n.openmindia.com/webhook/reembolso-resumo",
};

const TABELAS_VALIDAS = new Set(["emissoes", "emissoes_terceirizadas", "reembolsos"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: u } = await caller.auth.getUser();
  if (!u?.user) return json({ error: "Nao autenticado" }, 401);
  if (aalDoHeader(authHeader) !== "aal2") return json({ error: "Verificação em duas etapas obrigatória. Saia e entre de novo." }, 403);
  const { data: perfil } = await admin.from("perfis_usuario").select("papel,ativo,whatsapp,nome").eq("id", u.user.id).single();
  if (!perfil?.ativo) return json({ error: "Perfil inativo" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const acao = String(body.acao || "").toLowerCase();
  const forma = String(body.forma || "").toLowerCase();
  const emissaoId = body.emissao_id as string;
  const silencioso = acao === "cancelar" && body.silencioso === true;
  const statusFinal = String(body.status_final || "");
  const tabelaSolicitada = String(body.tabela || "emissoes");
  const tabela = TABELAS_VALIDAS.has(tabelaSolicitada) ? tabelaSolicitada : "emissoes";
  const foneDestino = String(body.fone_destino || perfil.whatsapp || "");
  if (!WEBHOOK_ENV[acao]) return json({ error: "Acao invalida (use cobrar, reprocessar, cancelar, reenviar ou reembolso_resumo)" }, 400);
  if (!emissaoId) return json({ error: "emissao_id obrigatorio" }, 400);

  const selectJoin = tabela === "emissoes_terceirizadas"
    ? "*, clientes(codigo,nome_fantasia,fone,email,cnpj_cpf), fornecedores(codigo,nome,chave_pix)"
    : tabela === "reembolsos"
      ? "*, clientes(codigo,nome_fantasia,fone,email,cnpj_cpf), cartoes(codigo,nome)"
      : "*, clientes(codigo,nome_fantasia,fone,email,cnpj_cpf), contas(codigo,nome,pix_envio), cartoes(codigo,nome)";

  const { data: emissao, error } = await admin
    .from(tabela)
    .select(selectJoin)
    .eq("id", emissaoId).single();
  if (error || !emissao) return json({ error: "Emissao nao encontrada" }, 404);

  if (acao === "reprocessar") await admin.from(tabela).update({ reprocessar: true }).eq("id", emissaoId);
  if (acao === "cancelar" && !silencioso) await admin.from(tabela).update({ cancelar: true }).eq("id", emissaoId);

  let envVar = WEBHOOK_ENV[acao];
  if (acao === "cobrar" && forma) {
    if (!WEBHOOK_FORMA_ENV[forma]) return json({ error: "Forma invalida (use pix, cartao ou link)" }, 400);
    if ((forma === "cartao" || forma === "link") && !Deno.env.get(WEBHOOK_FORMA_ENV[forma])) {
      return json({ ok: true, acao, forma, emissao_id: emissaoId, tabela, n8n: "pendente", aviso: `Cobranca por '${forma}' ainda nao foi configurada (defina ${WEBHOOK_FORMA_ENV[forma]}).` });
    }
    envVar = WEBHOOK_FORMA_ENV[forma];
  }

  const webhookUrl = Deno.env.get(envVar) || WEBHOOK_FALLBACK[acao];
  if (!webhookUrl) {
    const presentes = Object.values({...WEBHOOK_ENV, ...WEBHOOK_FORMA_ENV}).filter((k) => !!Deno.env.get(k));
    return json({ ok: true, acao, forma: forma || null, emissao_id: emissaoId, tabela, n8n: "pendente", aviso: `Webhook do N8n ainda nao configurado (defina ${envVar}). Secrets encontradas: ${presentes.join(", ") || "NENHUMA"}.` });
  }

  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao, forma: forma || null, emissao_id: emissaoId, tabela, fone_destino: foneDestino, emissor_nome: perfil.nome, emissao, silencioso, status_final: statusFinal }),
    });
    const txt = await r.text();
    return json({ ok: r.ok, acao, forma: forma || null, emissao_id: emissaoId, tabela, silencioso, n8n_status: r.status, n8n_resposta: txt.slice(0, 500) });
  } catch (e) {
    return json({ error: `Falha ao chamar o N8n: ${(e as Error).message}` }, 502);
  }
});
