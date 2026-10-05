import { createClient } from "jsr:@supabase/supabase-js@2";

// pagamentos-pix — o portao entre "quero pagar" e "o dinheiro saiu".
//
// O front NUNCA fala com o Sicoob. Ele fala com esta funcao, que valida quem e, valida
// o que esta sendo aprovado, e so entao manda o n8n executar. O n8n, por sua vez, rele
// tudo do banco: nada do que vem do navegador chega na API do banco.
//
// Acoes:
//   preparar      -> pede ao n8n a consulta DICT (nome do titular de cada chave). Nao move dinheiro.
//   enviar_codigo -> gera o codigo de 6 digitos e manda por e-mail ao aprovador. Amarrado ao lote.
//   aprovar       -> re-autentica a senha, confere o codigo e o Google Authenticator, libera a execucao.
//   extrato       -> monta o extrato do lote (pelo n8n, lendo o banco) para o operador.
//   cancelar      -> encerra o lote antes de qualquer envio (o botao "Reverter" da tela).
//   totp_*        -> cadastro e conferencia do Google Authenticator do aprovador.
//
// A trava que de fato protege o dinheiro nao esta aqui: e a coluna "Titular (Banco Central)"
// na tela de Conferencia. Isto aqui garante que quem apertou o botao e quem diz ser, e que
// o lote aprovado e exatamente o lote que sera pago.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const N8N_BASE = Deno.env.get("N8N_BASE_URL") ?? "https://n8n.openmindia.com/webhook";
// Segredo compartilhado com os fluxos n8n de pagamento. Trocar em producao pelo secret
// PAGAMENTOS_PIX_SECRET (o mesmo valor precisa ir no no "Conferir Segredo" dos fluxos).
const N8N_SECRET = Deno.env.get("PAGAMENTOS_PIX_SECRET") ?? "dt-pix-pag-2026-9f4c1a7e2b";
const EMAIL_APROVADOR = Deno.env.get("PIX_APROVADOR_EMAIL") ?? "bruno@dreamticketsbr.com";

const CODIGO_VALIDADE_MIN = 10;
const CODIGO_MAX_TENTATIVAS = 5;

// ---------------------------------------------------------------- Google Authenticator
// Terceira validacao da aprovacao: TOTP (RFC 6238) do aprovador. Seis digitos que mudam a
// cada 30 segundos, gerados no celular, sem passar por e-mail nem por rede — por isso
// continua valendo mesmo se a caixa de e-mail do aprovador for comprometida.
const TOTP_PASSO_S = 30;
const TOTP_JANELA = 1;                 // aceita o codigo anterior e o proximo (relogio torto)
const TOTP_EMISSOR = "DreamTickets";
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array) {
  let bits = 0, valor = 0, saida = "";
  for (const b of bytes) {
    valor = (valor << 8) | b; bits += 8;
    while (bits >= 5) { saida += B32[(valor >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) saida += B32[(valor << (5 - bits)) & 31];
  return saida;
}

function base32Decode(txt: string) {
  const limpo = txt.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, valor = 0;
  const out: number[] = [];
  for (const c of limpo) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    valor = (valor << 5) | i; bits += 5;
    if (bits >= 8) { out.push((valor >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

async function totpEm(secret: string, passo: number) {
  const chave = await crypto.subtle.importKey(
    "raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const contador = new Uint8Array(8);
  let n = passo;
  for (let i = 7; i >= 0; i--) { contador[i] = n & 0xff; n = Math.floor(n / 256); }
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", chave, contador));
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

// Devolve o passo em que o codigo bateu (para nao deixar reusar), ou null.
async function totpConferir(secret: string, codigo: string) {
  const agora = Math.floor(Date.now() / 1000 / TOTP_PASSO_S);
  for (let d = -TOTP_JANELA; d <= TOTP_JANELA; d++) {
    if (await totpEm(secret, agora + d) === codigo) return agora + d;
  }
  return null;
}

function segredoNovo() {
  const b = new Uint8Array(20);           // 160 bits, o recomendado pela RFC 4226
  crypto.getRandomValues(b);
  return base32Encode(b);
}

function otpauth(secret: string, conta: string) {
  return `otpauth://totp/${encodeURIComponent(TOTP_EMISSOR)}:${encodeURIComponent(conta)}`
       + `?secret=${secret}&issuer=${encodeURIComponent(TOTP_EMISSOR)}&algorithm=SHA1&digits=6&period=${TOTP_PASSO_S}`;
}

async function qrSvg(texto: string) {
  // QR gerado no servidor para o front nao precisar de biblioteca nova.
  // Se a importacao falhar, o cadastro ainda funciona pela chave digitada a mao.
  try {
    const mod: any = await import("https://esm.sh/qrcode-generator@1.4.4");
    const qr = (mod.default ?? mod)(0, "M");
    qr.addData(texto);
    qr.make();
    return qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true }) as string;
  } catch (_e) {
    return null;
  }
}

const ABERTOS = ["PREPARANDO", "AGUARDANDO_CONFERENCIA", "AGUARDANDO_APROVACAO"];
// Itens que nao entram no pagamento: ficam fora do total, da assinatura e da aprovacao.
const FORA = ["BLOQUEADO", "ERRO_INICIACAO", "CANCELADO"];

async function sha256(txt: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Assinatura do lote: identidade do que esta sendo aprovado. Se alguem mexer em um item
// depois do codigo enviado, a assinatura muda e o codigo deixa de servir.
async function assinarLote(itens: Array<{ id: string; valor: number; chave_pix: string | null; estado: string }>) {
  const vivos = itens.filter((i) => !FORA.includes(i.estado));
  const linhas = vivos
    .map((i) => `${i.id}:${Number(i.valor).toFixed(2)}:${i.chave_pix ?? ""}`)
    .sort();
  const total = vivos.reduce((a, i) => a + Number(i.valor || 0), 0).toFixed(2);
  return await sha256(`${linhas.join("|")}#${vivos.length}#${total}`);
}

function mascararEmail(e: string) {
  const [u, d] = e.split("@");
  if (!d) return "o aprovador";
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}

async function chamarN8n(rota: string, corpo: unknown) {
  const r = await fetch(`${N8N_BASE}/${rota}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pix-secret": N8N_SECRET },
    body: JSON.stringify(corpo),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`n8n ${rota} respondeu ${r.status}: ${txt.slice(0, 200)}`);
  try { return JSON.parse(txt); } catch { return { ok: true }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não suportado." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ erro: "Não autenticado." }, 401);

  const comUsuario = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await comUsuario.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ erro: "Sessão expirada. Entre de novo." }, 401);

  const db = createClient(url, service, { auth: { persistSession: false } });

  let body: any;
  try { body = await req.json(); } catch { return json({ erro: "Corpo inválido." }, 400); }
  const acao = String(body?.acao ?? "");
  const loteId = String(body?.lote_id ?? "");
  if (!acao) return json({ erro: "Ação não informada." }, 400);
  // As acoes do Google Authenticator nao falam de lote nenhum.
  const SEM_LOTE = ["totp_status", "totp_iniciar", "totp_confirmar"];
  if (!loteId && !SEM_LOTE.includes(acao)) return json({ erro: "Lote não informado." }, 400);

  // Quem pode mexer em lote de pagamento: quem tem a tela de Conferencia Pix.
  const { data: perfil } = await db
    .from("perfis_usuario").select("id, nome, email, papel, ativo, whatsapp").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.ativo === false) return json({ erro: "Usuário sem acesso." }, 403);

  if (perfil.papel !== "super_admin") {
    const { data: liberada } = await db
      .from("usuario_telas").select("telas!inner(chave)")
      .eq("usuario_id", user.id).eq("telas.chave", "conferencia_pix").maybeSingle();
    if (!liberada) return json({ erro: "Você não tem acesso à Conferência Pix." }, 403);
  }

  // ------------------------------------------- Google Authenticator (sem lote)
  // O segredo e do APROVADOR, igual ao codigo por e-mail. Por isso so admin/super_admin
  // enxerga o QR Code: se um operador pudesse cadastrar, ele apontaria o app para o
  // proprio celular e a terceira validacao viraria enfeite.
  if (SEM_LOTE.includes(acao)) {
    const ehAdmin = perfil.papel === "admin" || perfil.papel === "super_admin";
    const { data: totp } = await db.from("pagamentos_totp").select("*").eq("id", true).maybeSingle();

    if (acao === "totp_status") {
      return json({
        ok: true,
        cadastrado: !!totp?.ativo && !!totp?.secret_base32,
        pendente: !!totp?.secret_pendente,
        pode_cadastrar: ehAdmin,
      });
    }

    if (!ehAdmin) return json({ erro: "Só um administrador cadastra o aplicativo do aprovador." }, 403);

    if (acao === "totp_iniciar") {
      // O segredo novo entra como PENDENTE. O que ja valia continua valendo ate alguem
      // provar que o aparelho novo funciona — troca abandonada no meio nao derruba a
      // validacao, que e o que aconteceria se isto sobrescrevesse o segredo em uso.
      const secret = segredoNovo();
      const { error: eUp } = await db.from("pagamentos_totp")
        .upsert({ id: true, secret_pendente: secret, criado_por: user.id,
                  criado_em: new Date().toISOString() }, { onConflict: "id" });
      if (eUp) return json({ erro: eUp.message }, 500);

      const uri = otpauth(secret, EMAIL_APROVADOR);
      return json({ ok: true, chave: secret, uri, qr_svg: await qrSvg(uri), emissor: TOTP_EMISSOR, conta: EMAIL_APROVADOR });
    }

    if (acao === "totp_confirmar") {
      if (!totp?.secret_pendente) return json({ erro: "Comece gerando o QR Code." }, 409);
      const codigo = String(body?.totp ?? "").replace(/\D/g, "");
      if (codigo.length !== 6) return json({ erro: "Digite os 6 dígitos que aparecem no aplicativo." }, 400);
      const passo = await totpConferir(totp.secret_pendente, codigo);
      if (passo === null) {
        return json({ erro: "Código não confere. Confira se leu o QR Code certo e se a hora do celular está automática." }, 401);
      }
      // So agora o segredo novo passa a valer.
      const { error: eAt } = await db.from("pagamentos_totp")
        .update({ secret_base32: totp.secret_pendente, secret_pendente: null, ativo: true,
                  ultimo_step: passo, ativado_em: new Date().toISOString(), ativado_por: user.id })
        .eq("id", true);
      if (eAt) return json({ erro: eAt.message }, 500);
      return json({ ok: true });
    }
  }

  const { data: lote, error: eLote } = await db
    .from("pagamentos_lote").select("*").eq("id", loteId).maybeSingle();
  if (eLote) return json({ erro: eLote.message }, 500);
  if (!lote) return json({ erro: "Lote não encontrado." }, 404);

  const { data: itens } = await db
    .from("pagamentos_lote_itens")
    .select("id, valor, chave_pix, estado, titular_nome, metodo")
    .eq("lote_id", loteId);
  const lista = itens ?? [];
  const vivos = lista.filter((i: any) => !FORA.includes(i.estado));

  try {
    // ---------------------------------------------------------------- preparar
    if (acao === "preparar") {
      if (!ABERTOS.includes(lote.status)) return json({ erro: `Lote em ${lote.status} — não dá para preparar.` }, 409);
      if (vivos.length === 0) return json({ erro: "Nenhum item pagável neste lote." }, 400);

      await db.from("pagamentos_lote")
        .update({ status: "PREPARANDO", erro: null, updated_by: user.id })
        .eq("id", loteId);

      await chamarN8n("pagamentos-pix-preparar", { lote_id: loteId });
      return json({ ok: true });
    }

    // ----------------------------------------------------------- enviar_codigo
    if (acao === "enviar_codigo") {
      if (!ABERTOS.includes(lote.status)) return json({ erro: `Lote em ${lote.status} — não dá para enviar código.` }, 409);
      if (!lote.exige_codigo) return json({ erro: "Este lote não exige código." }, 400);

      const assinatura = await assinarLote(vivos as any);
      const codigo = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
      const hash = await sha256(`${loteId}:${codigo}`);
      const expira = new Date(Date.now() + CODIGO_VALIDADE_MIN * 60_000).toISOString();

      // Codigo anterior do mesmo lote morre agora — so o ultimo enviado vale.
      await db.from("pagamentos_codigo").delete().eq("lote_id", loteId).is("usado_em", null);
      const { error: eIns } = await db.from("pagamentos_codigo").insert({
        lote_id: loteId, codigo_hash: hash, assinatura,
        enviado_para: EMAIL_APROVADOR, expira_em: expira, tentativas: 0,
      });
      if (eIns) return json({ erro: eIns.message }, 500);

      await db.from("pagamentos_lote")
        .update({ assinatura, status: "AGUARDANDO_APROVACAO", updated_by: user.id })
        .eq("id", loteId);

      const total = vivos.reduce((a: number, i: any) => a + Number(i.valor || 0), 0);
      await chamarN8n("pagamentos-pix-codigo", {
        lote_id: loteId,
        email: EMAIL_APROVADOR,
        codigo,
        tipo: lote.tipo,
        qtd: vivos.length,
        total: total.toFixed(2),
        solicitante: perfil.nome ?? perfil.email ?? "operador",
        validade_min: CODIGO_VALIDADE_MIN,
      });

      return json({ ok: true, enviado_para: mascararEmail(EMAIL_APROVADOR) });
    }

    // ----------------------------------------------------------------- aprovar
    if (acao === "aprovar") {
      if (!ABERTOS.includes(lote.status)) return json({ erro: `Lote em ${lote.status} — não dá para aprovar.` }, 409);
      if (new Date(lote.expira_em).getTime() < Date.now()) {
        await db.from("pagamentos_lote").update({ status: "EXPIRADO" }).eq("id", loteId);
        return json({ erro: "Lote expirado. Monte de novo." }, 409);
      }
      if (vivos.length === 0) return json({ erro: "Nenhum item pagável neste lote." }, 400);

      // Sem o nome do titular nao se aprova: e a conferencia inteira que estaria faltando.
      const semTitular = vivos.filter((i: any) => i.metodo === "CHAVE" && !i.titular_nome);
      if (semTitular.length > 0) {
        return json({ erro: `Faltam ${semTitular.length} consulta(s) de titular. Clique em "Consultar titulares".` }, 409);
      }

      const senha = String(body?.senha ?? "");
      if (!senha) return json({ erro: "Digite sua senha do sistema." }, 400);

      // Reautenticacao: sessao aberta na maquina de alguem nao aprova pagamento.
      //
      // NAO usa signInWithPassword. O login do app tem captcha (Turnstile) ligado no
      // Supabase, e captcha nao existe do lado do servidor: toda tentativa era recusada,
      // e com a senha CERTA tambem falhava. A conferencia vai direto no hash, com trava
      // propria de tentativas (5 erros em 15 min bloqueiam por 15 min).
      const { data: conf, error: eConf } = await db.rpc("pagamentos_conferir_senha", {
        p_usuario: user.id, p_senha: senha,
      });
      if (eConf) return json({ erro: `Não foi possível conferir a senha: ${eConf.message}` }, 500);

      const r = conf as { ok: boolean; motivo?: string; restantes?: number; bloqueado_ate?: string };
      if (!r?.ok) {
        if (r?.motivo === "bloqueado") {
          const ate = r.bloqueado_ate ? new Date(r.bloqueado_ate) : null;
          const min = ate ? Math.max(1, Math.ceil((ate.getTime() - Date.now()) / 60000)) : 15;
          return json({ erro: `Senha errada vezes demais. Espere ${min} minuto(s) e tente de novo.` }, 429);
        }
        if (r?.motivo === "sem_senha") {
          return json({ erro: "Sua conta não tem senha cadastrada. Defina uma senha antes de aprovar pagamentos." }, 401);
        }
        const rest = Number(r?.restantes ?? 0);
        return json({
          erro: rest > 0
            ? `Senha incorreta. Restam ${rest} tentativa(s) antes de bloquear por 15 minutos.`
            : "Senha incorreta.",
        }, 401);
      }

      const assinaturaAgora = await assinarLote(vivos as any);

      if (lote.exige_codigo) {
        const codigo = String(body?.codigo ?? "").replace(/\D/g, "");
        if (codigo.length !== 6) return json({ erro: "Digite o código de 6 dígitos do aprovador." }, 400);

        const { data: reg } = await db
          .from("pagamentos_codigo").select("*")
          .eq("lote_id", loteId).is("usado_em", null)
          .order("criado_em", { ascending: false }).limit(1).maybeSingle();

        if (!reg) return json({ erro: "Nenhum código ativo. Clique em \"Enviar código\"." }, 409);
        if (new Date(reg.expira_em).getTime() < Date.now()) {
          return json({ erro: "Código expirado. Peça um novo." }, 409);
        }
        if (reg.tentativas >= CODIGO_MAX_TENTATIVAS) {
          return json({ erro: "Código bloqueado por excesso de tentativas. Peça um novo." }, 429);
        }
        // O codigo vale para ESTE lote, do jeito que ele esta agora.
        if (reg.assinatura !== assinaturaAgora) {
          return json({ erro: "O lote mudou depois que o código foi enviado. Peça um novo código." }, 409);
        }
        const hash = await sha256(`${loteId}:${codigo}`);
        if (hash !== reg.codigo_hash) {
          await db.from("pagamentos_codigo").update({ tentativas: reg.tentativas + 1 }).eq("id", reg.id);
          return json({ erro: "Código incorreto." }, 401);
        }
        await db.from("pagamentos_codigo").update({ usado_em: new Date().toISOString() }).eq("id", reg.id);
      }

      // --------- terceira validacao: codigo do Google Authenticator do aprovador
      // Obrigatoria SEMPRE. Sem app cadastrado nao sai pagamento nenhum: se a validacao
      // pudesse ser pulada por falta de cadastro, ela nao seria uma validacao.
      const { data: totpReg } = await db.from("pagamentos_totp").select("*").eq("id", true).maybeSingle();
      if (!totpReg?.ativo || !totpReg.secret_base32) {
        return json({
          erro: "O Google Authenticator do aprovador ainda não foi cadastrado, e sem ele nenhum pagamento é liberado. Um administrador precisa cadastrar o aplicativo aqui na Conferência Pix.",
        }, 409);
      }
      {
        const totpCod = String(body?.totp ?? "").replace(/\D/g, "");
        if (totpCod.length !== 6) {
          return json({ erro: "Digite os 6 dígitos do aplicativo Google Authenticator." }, 400);
        }
        const passo = await totpConferir(totpReg.secret_base32, totpCod);
        if (passo === null) return json({ erro: "Código do Google Authenticator incorreto." }, 401);
        // Cada codigo serve uma vez so: o mesmo numero nao aprova dois lotes. A condicao
        // vai no proprio UPDATE, entao duas abas simultaneas nao passam as duas.
        const { data: gravou, error: ePasso } = await db.from("pagamentos_totp")
          .update({ ultimo_step: passo }).eq("id", true)
          .or(`ultimo_step.is.null,ultimo_step.lt.${passo}`)
          .select("id").maybeSingle();
        if (ePasso) return json({ erro: ePasso.message }, 500);
        if (!gravou) return json({ erro: "Este código já foi usado. Espere o aplicativo trocar e tente de novo." }, 409);
      }

      // Trava de corrida: so sai de um status aberto uma vez.
      const { data: aprovado, error: eUpd } = await db.from("pagamentos_lote")
        .update({
          status: "APROVADO", assinatura: assinaturaAgora,
          aprovado_por: user.id, aprovado_em: new Date().toISOString(),
          conferido_em: new Date().toISOString(), erro: null, updated_by: user.id,
        })
        .eq("id", loteId).in("status", ABERTOS).select("id").maybeSingle();
      if (eUpd) return json({ erro: eUpd.message }, 500);
      if (!aprovado) return json({ erro: "Este lote já foi aprovado ou encerrado." }, 409);

      try {
        await chamarN8n("pagamentos-pix-executar", { lote_id: loteId });
      } catch (e) {
        // Aprovado fica: a varredura periodica retoma. Melhor do que reabrir e
        // arriscar uma segunda aprovacao para o mesmo dinheiro.
        await db.from("pagamentos_lote")
          .update({ erro: `Aprovado, mas a execução não iniciou: ${(e as Error).message}` })
          .eq("id", loteId);
        return json({ ok: true, aviso: "Lote aprovado. A execução será retomada automaticamente." });
      }

      return json({ ok: true });
    }

    // ----------------------------------------------------------------- extrato
    // O texto e montado pelo n8n lendo o banco. O navegador nao dita o conteudo do
    // extrato — ele so pede. Quando pede envio, vai para o WhatsApp de quem pediu.
    if (acao === "extrato") {
      const enviar = body?.enviar === true;
      const r = await chamarN8n("pagamentos-pix-extrato", {
        lote_id: loteId,
        enviar,
        whatsapp: enviar ? (perfil.whatsapp ?? "") : "",
      });
      if (enviar && !r?.enviado) {
        return json({ ok: true, texto: r?.texto ?? "", enviado: false,
                      aviso: "Extrato pronto, mas não há WhatsApp no seu cadastro de usuário." });
      }
      return json({ ok: true, texto: r?.texto ?? "", enviado: !!r?.enviado });
    }

    // ------------------------------------------------------ cancelar/descartar
    // Os dois sao a mesma coisa por baixo: apagar uma tentativa que nao moveu dinheiro.
    // "Reverter" e quando o operador desiste antes de aprovar; "Descartar" e quando o
    // banco recusou tudo e o lote virou sujeira na tela. Lote que pagou alguma coisa e
    // historico financeiro e a funcao do banco recusa apagar — a decisao nao e do botao.
    if (acao === "cancelar" || acao === "descartar") {
      const { data: d, error: eDesc } = await db.rpc("pagamentos_descartar_lote", { p_lote: loteId });
      if (eDesc) return json({ erro: eDesc.message }, 500);

      const res = d as { ok: boolean; motivo?: string; pagos?: number; enviados?: number; tipo?: string };
      if (!res?.ok) {
        if (res?.motivo === "tem_pagamento") {
          return json({ erro: `Este lote tem ${res.pagos} pagamento(s) feito(s) e fica no histórico — não dá para apagar.` }, 409);
        }
        if (res?.motivo === "em_transito") {
          return json({ erro: `${res.enviados} pagamento(s) foram enviados ao banco e ainda aguardam resposta. Espere o retorno antes de descartar.` }, 409);
        }
        return json({ erro: "Este lote não pode ser descartado." }, 409);
      }
      return json({ ok: true, tipo: res.tipo ?? lote.tipo });
    }

    return json({ erro: `Ação desconhecida: ${acao}` }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message ?? "Erro inesperado." }, 500);
  }
});
