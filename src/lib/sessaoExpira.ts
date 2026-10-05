// Expiração forçada da sessão: o app derruba para a tela de login algumas horas depois
// do LOGIN, mesmo com o usuário ativo.
//
// Por que aqui e não no Supabase: o client roda com `autoRefreshToken`, então o token se
// renova para sempre e a sessão nunca morre sozinha. O "Time-box user sessions" do painel
// do Supabase faria isso do lado do servidor, mas só existe do plano Pro para cima — e o
// projeto está no Free. Quando subir de plano, ligue o Time-box lá também: este guard
// continua valendo como aviso ao usuário, e o servidor passa a ser a garantia real.
//
// REFERÊNCIA DAS 12 HORAS (desde 05/10/2026): o ÚLTIMO LOGIN gravado no banco
// (auth.users.last_sign_in_at), lido do servidor com supabase.auth.getUser() — o mesmo
// horário que aparece no controle de logins. Antes era um marcador no localStorage do
// navegador, que podia divergir do login real. Como a sessão é única por usuário
// (lib/sessaoUnica.ts), o último login do usuário é o login desta sessão.
//
// Ainda não é a garantia do servidor (isso só com o Time-box do plano Pro) — é higiene de
// sessão: não deixar o app aberto e logado para sempre no navegador.

export const SESSAO_MAX_HORAS = 12;
const SESSAO_MAX_MS = SESSAO_MAX_HORAS * 60 * 60 * 1000;

// Minutos que faltam para o fim quando o app avisa o usuário (do maior para o menor).
export const AVISOS_MINUTOS = [5, 1];

// Marcador antigo (até 05/10/2026) — só é apagado, não é mais usado.
const CHAVE_ANTIGA = "dt_sessao_inicio";

// O access_token traz o claim `session_id`, que NÃO muda quando o token é renovado.
// É por ele que o relógio continua contando entre refreshes, reloads e abas — e é por ele
// que um login novo começa a contar do zero.
export function sessionIdDoToken(accessToken?: string | null): string | null {
  try {
    const payload = accessToken?.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json)?.session_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Horário do login desta sessão segundo o próprio token (claim `amr`, assinado pelo
 * Supabase e que não muda no refresh). Só é usado se não der para ler o último login
 * do banco (ex.: sem rede no momento).
 */
export function loginDoToken(accessToken?: string | null): number | null {
  try {
    const payload = accessToken?.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const ts = (json?.amr ?? []).map((a: any) => Number(a?.timestamp)).filter((n: number) => n > 0);
    return ts.length ? Math.max(...ts) * 1000 : null;
  } catch {
    return null;
  }
}

/** Converte o last_sign_in_at (ISO) em ms; null se vier vazio/inválido. */
export function msDoLogin(lastSignInAt?: string | null): number | null {
  if (!lastSignInAt) return null;
  const ms = new Date(lastSignInAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Quantos ms faltam para a sessão estourar, contando SESSAO_MAX_HORAS a partir do login.
 * 0 = já estourou. `null` = sem horário de login conhecido — aí o app não derruba
 * ninguém, porque errar para o lado de deslogar sem motivo é pior.
 */
export function msAteExpirar(inicioLoginMs: number | null): number | null {
  if (inicioLoginMs == null) return null;
  return Math.max(0, inicioLoginMs + SESSAO_MAX_MS - Date.now());
}

/** Remove o marcador antigo do localStorage (resto da versão anterior). */
export function limparInicioSessao() {
  try {
    localStorage.removeItem(CHAVE_ANTIGA);
  } catch {
    /* sem localStorage não há o que limpar */
  }
}
