import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

// Pagina publica de pagamento: retorna SOMENTE os dados nao-sensiveis necessarios
// para o cliente pagar (valor, copia-e-cola, status). Sem auth.
// Procura em emissoes, emissoes_terceirizadas e reembolsos (nessa ordem).
//
// CHAVE DO LINK
// Ate 09/2026 a chave era o id_emissao (JS000859), que e sequencial: trocando o numero
// dava para ler nome do cliente, valor e copia-e-cola de qualquer outra cobranca. Agora a
// chave e o pix_txid (32 hex, aleatorio, um por cobranca). O id_emissao antigo ainda passa
// ate LEGADO_ATE, so para nao quebrar os links ja enviados no WhatsApp.
//
// Efeito colateral bom: recobrar gera um txid novo, entao o link antigo morre sozinho.
const LEGADO_ATE = new Date("2026-09-29T03:00:00Z"); // fim de 28/09 no horario de Brasilia (20 dias)

// Cobranca encerrada nao tem link: alem de nao ser pagavel, responder "pago" confirmaria
// para um curioso que aquela cobranca existe.
const ENCERRADOS = ["PAGO", "CANCELADO"];

const RE_TXID = /^[0-9a-f]{32}$/i;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resposta unica para "nao existe", "encerrada" e "chave velha": mesmo status, mesmo
// corpo, para quem chuta chave nao aprender nada com a diferenca.
//
// A PixPublicoPage NAO mostra este texto: ela renderiza o 404 padrao do app, como se a URL
// nunca tivesse existido. O texto existe so como rede para o front antigo (enquanto a
// versao nova nao for publicada) e para quem chamar a funcao direto. Nao coloque nada aqui
// que revele se a cobranca existe ou em que estado ela esta.
const NAO_DISPONIVEL = { error: "Esta cobrança não está mais ativa. Se você já efetuou o pagamento, não é preciso fazer nada." };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const u = new URL(req.url);
  const id = (u.searchParams.get("id") || "").trim();
  if (!id) return json({ error: "id obrigatorio" }, 400);

  // Rate limit por IP contando SO AS FALHAS. Os emissores ficam todos atras do mesmo IP do
  // escritorio e abrem varios links por dia — mas links validos, que nao contam. Quem varre
  // chaves produz quase so falha. Falha do limitador nao derruba pagamento (fail-open).
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") || "";
  const registrarFalha = async () => {
    try { await admin.rpc("pix_publico_falha", { p_ip: ip }); } catch { /* nao atrapalha a resposta */ }
  };
  const recusar = async () => { await registrarFalha(); return json(NAO_DISPONIVEL, 404); };

  try {
    const { data: pode, error } = await admin.rpc("pix_publico_pode", { p_ip: ip });
    if (!error && pode === false) {
      return json({ error: "Muitas tentativas. Tente de novo em alguns minutos." }, 429);
    }
  } catch { /* limitador indisponivel: segue o jogo */ }

  const porTxid = RE_TXID.test(id);
  const porUuid = !porTxid && RE_UUID.test(id);
  const porLegado = !porTxid && !porUuid;

  // Chave antiga (id_emissao / reembolso_id) so vale durante a transicao.
  if (porLegado && new Date() > LEGADO_ATE) return await recusar();

  const buscarEmissao = async (tabela: string) => {
    const col = porTxid ? "pix_txid" : porUuid ? "id" : "id_emissao";
    const { data } = await admin
      .from(tabela)
      .select("id_emissao, localizador, programa, nome_operacao, preco_total, status_pix, pix_copia_cola, clientes(nome_fantasia)")
      .eq(col, id)
      .maybeSingle();
    if (!data) return null;
    return {
      id_emissao: (data as any).id_emissao,
      localizador: (data as any).localizador,
      programa: (data as any).programa,
      operacao: (data as any).nome_operacao,
      valor: (data as any).preco_total,
      status: (data as any).status_pix,
      pix_copia_cola: (data as any).pix_copia_cola,
      cliente: ((data as any).clientes as any)?.nome_fantasia ?? null,
    };
  };

  const buscarReembolso = async () => {
    const col = porTxid ? "pix_txid" : porUuid ? "id" : "reembolso_id";
    const { data } = await admin
      .from("reembolsos")
      .select("reembolso_id, localizador, id_emissao, preco_total, status_pix, pix_copia_cola, clientes(nome_fantasia)")
      .eq(col, id)
      .maybeSingle();
    if (!data) return null;
    return {
      id_emissao: (data as any).reembolso_id,
      localizador: (data as any).localizador,
      programa: "Reembolso",
      operacao: (data as any).id_emissao ? `Ref. emissao ${(data as any).id_emissao}` : null,
      valor: (data as any).preco_total,
      status: (data as any).status_pix,
      pix_copia_cola: (data as any).pix_copia_cola,
      cliente: ((data as any).clientes as any)?.nome_fantasia ?? null,
    };
  };

  const resultado =
    (await buscarEmissao("emissoes")) ??
    (await buscarEmissao("emissoes_terceirizadas")) ??
    (await buscarReembolso());

  if (!resultado) return await recusar();
  if (ENCERRADOS.includes(String(resultado.status || "").toUpperCase())) return await recusar();
  if (!resultado.pix_copia_cola) return await recusar();

  return json(resultado);
});
