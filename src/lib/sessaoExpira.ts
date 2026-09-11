// Expiração forçada da sessão: o app derruba para a tela de login algumas horas depois
// do LOGIN, mesmo com o usuário ativo.
//
// Por que aqui e não no Supabase: o client roda com `autoRefreshToken`, então o token se
// renova para sempre e a sessão nunca morre sozinha. O "Time-box user sessions" do painel
// do Supabase faria isso do lado do servidor, mas só existe do plano Pro para cima — e o
// projeto está no Free. Quando subir de plano, ligue o Time-box lá também: este guard
// continua valendo como aviso ao usuário, e o servidor passa a ser a garantia real.
//
// Isto NÃO é barreira de segurança (o marcador é localStorage, dá para adulterar). É
// higiene de sessão: não deixar o app aberto e logado para sempre no navegador.

export const SESSAO_MAX_HORAS = 12;
const SESSAO_MAX_MS = SESSAO_MAX_HORAS * 60 * 60 * 1000;

// Minutos que faltam para o fim quando o app avisa o usuário (do maior para o menor).
export const AVISOS_MINUTOS = [5, 1];

const CHAVE = "dt_sessao_inicio";

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
 * Quantos ms faltam para a sessão estourar. 0 = já estourou.
 * `null` = não dá para saber (sem token, ou localStorage bloqueado) — nesse caso o app não
 * derruba ninguém, porque errar para o lado de deslogar sem motivo é pior.
 *
 * Na primeira chamada de cada sessão, grava o horário de início.
 */
export function msAteExpirar(accessToken?: string | null): number | null {
  const sid = sessionIdDoToken(accessToken);
  if (!sid) return null;
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || "null");
    const inicio = salvo?.sid === sid && typeof salvo?.em === "number" ? salvo.em : null;
    if (inicio == null) {
      localStorage.setItem(CHAVE, JSON.stringify({ sid, em: Date.now() }));
      return SESSAO_MAX_MS;
    }
    return Math.max(0, inicio + SESSAO_MAX_MS - Date.now());
  } catch {
    return null;
  }
}

export function limparInicioSessao() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* sem localStorage não há o que limpar */
  }
}
