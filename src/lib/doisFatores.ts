// Verificação em duas etapas (2FA) — OBRIGATÓRIA para todos os usuários desde 06/11/2026.
//
// Como funciona:
// - Senha certa dá uma sessão de nível "aal1". Ela só serve para cadastrar/conferir o
//   código do app autenticador (Google Authenticator, Microsoft Authenticator, Authy...).
// - Depois do código de 6 dígitos a sessão vira "aal2" e só então o app abre.
// - A garantia real está no servidor, não aqui:
//     * banco: função public.exigir_mfa() rodando como pre-request do PostgREST recusa
//       QUALQUER chamada de usuário logado que não seja aal2 (tabelas e RPCs);
//     * Realtime: políticas RESTRICTIVE "mfa_obrigatorio" nas tabelas publicadas;
//     * edge functions chamadas pelo app (admin-usuarios, disparar-n8n, pagamentos-pix,
//       cobranca-agrupada) recusam token sem aal2.
//   O front só decide qual tela mostrar.
// - Perdeu o celular? Admin/super admin clica em "Zerar 2FA" na tela Usuários e a pessoa
//   cadastra de novo no próximo acesso.

export type NivelAcesso = "aal1" | "aal2" | null;

/** Lê o claim `aal` do access_token (assinado pelo Supabase). */
export function aalDoToken(accessToken?: string | null): NivelAcesso {
  try {
    const payload = accessToken?.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const aal = json?.aal;
    return aal === "aal1" || aal === "aal2" ? aal : null;
  } catch {
    return null;
  }
}

/** O qr_code do Supabase pode vir como data URL ou como SVG cru — devolve sempre um src de <img>. */
export function srcDoQr(qr?: string | null): string {
  if (!qr) return "";
  if (qr.startsWith("data:")) return qr;
  return `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`;
}

export const ISSUER_2FA = "DreamTickets";
