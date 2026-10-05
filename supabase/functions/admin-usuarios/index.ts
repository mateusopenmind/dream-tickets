import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Regra de senha forte (mesma do front)
function senhaForte(s: string): boolean {
  return !!s && s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s);
}

// Gera senha temporaria forte e legivel (sempre passa em senhaForte)
function gerarSenha(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const b = "abcdefghijkmnpqrstuvwxyz";
  const n = "23456789";
  const s = "!@#$%&*";
  const pick = (set: string, q: number) => Array.from({ length: q }, () => set[Math.floor(Math.random() * set.length)]).join("");
  const base = pick(a, 2) + pick(b, 4) + pick(n, 3) + pick(s, 1);
  return base.split("").sort(() => Math.random() - 0.5).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Nao autenticado" }, 401);
  const callerId = userData.user.id;

  const { data: perfil } = await admin
    .from("perfis_usuario").select("papel, ativo").eq("id", callerId).single();
  if (!perfil || !perfil.ativo) return json({ error: "Perfil inativo ou inexistente" }, 403);
  const isSuper = perfil.papel === "super_admin";
  const isAdmin = perfil.papel === "admin" || isSuper;
  if (!isAdmin) return json({ error: "Sem permissao (apenas admin/super admin)" }, 403);

  let payload: any = {};
  try { payload = await req.json(); } catch { /* */ }
  const action = payload.action as string;

  try {
    if (action === "list") {
      const { data, error } = await admin
        .from("perfis_usuario")
        .select("id, nome, email, papel, gl_id, whatsapp, ativo, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ usuarios: data });
    }

    if (action === "create") {
      const { nome, email, papel, gl_id, whatsapp } = payload;
      if (!nome || !email || !gl_id || !whatsapp) return json({ error: "Campos obrigatorios: nome, email, gl_id, whatsapp" }, 400);
      const novoPapel = (papel as string) || "operador";
      if (!isSuper && novoPapel !== "operador") return json({ error: "Admin so pode criar operadores" }, 403);
      if (novoPapel === "super_admin") return json({ error: "Nao e permitido criar outro super admin por aqui" }, 403);

      // Senha temporaria: usa a enviada (se forte) ou gera uma forte
      const senha = senhaForte(payload.senha as string) ? (payload.senha as string) : gerarSenha();

      // Cria usuario via Auth API (preenche tokens corretamente, sem bug de NULL)
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome, deve_trocar_senha: true },
      });
      if (cErr) throw cErr;
      const uid = created.user.id;

      const { error: pErr } = await admin.from("perfis_usuario").insert({
        id: uid, nome, email, papel: novoPapel, gl_id, whatsapp, ativo: true,
      });
      if (pErr) {
        // rollback do usuario auth se o perfil falhar
        await admin.auth.admin.deleteUser(uid);
        throw pErr;
      }
      return json({ ok: true, id: uid, senha_temporaria: senha });
    }

    // Reset de senha: admin e super admin resetam QUALQUER usuario (pedido do Mateus, 11/09/2026).
    // A senha gerada e temporaria e o usuario e obrigado a trocar no proximo acesso.
    if (action === "reset_senha") {
      const { id } = payload;
      if (!id) return json({ error: "id obrigatorio" }, 400);
      const { data: alvo } = await admin.from("perfis_usuario").select("papel").eq("id", id).single();
      if (!alvo) return json({ error: "Usuario nao encontrado" }, 404);
      const senha = gerarSenha();
      const { error } = await admin.auth.admin.updateUserById(id, { password: senha, user_metadata: { deve_trocar_senha: true } });
      if (error) throw error;
      return json({ ok: true, senha_temporaria: senha });
    }

    if (action === "update") {
      const { id, nome, papel, gl_id, whatsapp, ativo } = payload;
      if (!id) return json({ error: "id obrigatorio" }, 400);
      const { data: alvo } = await admin.from("perfis_usuario").select("papel").eq("id", id).single();
      if (!alvo) return json({ error: "Usuario nao encontrado" }, 404);
      if (!isSuper) {
        if (alvo.papel !== "operador") return json({ error: "Admin so edita operadores" }, 403);
        if (papel && papel !== "operador") return json({ error: "Admin nao altera papel" }, 403);
      }
      const patch: any = {};
      if (nome !== undefined) patch.nome = nome;
      if (gl_id !== undefined) patch.gl_id = gl_id;
      if (whatsapp !== undefined) patch.whatsapp = whatsapp;
      if (ativo !== undefined) patch.ativo = ativo;
      if (papel !== undefined && isSuper) patch.papel = papel;
      const { error } = await admin.from("perfis_usuario").update(patch).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "set_telas") {
      const { id, tela_ids } = payload as { id: string; tela_ids: string[] };
      if (!id || !Array.isArray(tela_ids)) return json({ error: "id e tela_ids obrigatorios" }, 400);

      const { data: alvo } = await admin.from("perfis_usuario").select("papel").eq("id", id).single();
      if (!alvo) return json({ error: "Usuario nao encontrado" }, 404);

      let idsFinais: string[];

      if (isSuper) {
        // Super admin define livremente
        idsFinais = [...new Set(tela_ids)];
      } else {
        // Admin: so libera para operador, e somente telas que ele proprio possui.
        if (alvo.papel !== "operador") return json({ error: "Admin so libera telas de operadores" }, 403);

        // Telas que o admin possui (ids)
        const { data: minhas } = await admin
          .from("usuario_telas").select("tela_id").eq("usuario_id", callerId);
        const minhasIds = new Set((minhas ?? []).map((r: any) => r.tela_id));

        // Telas que o alvo ja tinha (para preservar as fora do alcance do admin)
        const { data: doAlvo } = await admin
          .from("usuario_telas").select("tela_id").eq("usuario_id", id);
        const alvoIds = (doAlvo ?? []).map((r: any) => r.tela_id);

        const preservadas = alvoIds.filter((t: string) => !minhasIds.has(t));
        const gerenciadas = tela_ids.filter((t: string) => minhasIds.has(t));
        idsFinais = [...new Set([...preservadas, ...gerenciadas])];
      }

      await admin.from("usuario_telas").delete().eq("usuario_id", id);
      if (idsFinais.length > 0) {
        const rows = idsFinais.map((t) => ({ usuario_id: id, tela_id: t }));
        const { error } = await admin.from("usuario_telas").insert(rows);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (action === "get_telas") {
      const { id } = payload;
      if (!id) return json({ error: "id obrigatorio" }, 400);
      const { data, error } = await admin.from("usuario_telas").select("tela_id").eq("usuario_id", id);
      if (error) throw error;
      return json({ tela_ids: (data ?? []).map((r: any) => r.tela_id) });
    }

    return json({ error: "Acao invalida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
