// Sessão única por usuário: quando alguém entra, as outras sessões do MESMO login
// (outro navegador, outro computador, aba anônima) caem para a tela de login.
//
// Como funciona: a tabela `sessoes_ativas` guarda uma linha por usuário com o claim
// `session_id` do JWT da sessão vigente. Quem entra grava o seu ali; as abas já abertas
// escutam essa linha por Realtime (com uma conferida periódica de reserva, para rede que
// bloqueia websocket) e, ao ver um session_id diferente do seu, deslogam.
//
// Por que aqui e não no Supabase: o painel tem "Single session per user" em
// Authentication → Sessions, mas é do plano Pro para cima — e o projeto está no Free
// (mesma limitação do Time-box, ver lib/sessaoExpira.ts). Se um dia subir de plano,
// ligue lá também: o servidor passa a ser a garantia e este guard vira o aviso na tela.
//
// Isto NÃO é barreira de segurança: roda no navegador, então quem adulterar o front
// continua com o token válido. É controle de uso — impedir que o mesmo login seja
// operado por duas pessoas ao mesmo tempo.

import { supabase } from "@/integrations/supabase/client";

// Abas do MESMO navegador compartilham a sessão (mesmo session_id), então nunca se
// derrubam entre si. Só conta como acesso novo um login de verdade.
export const AVISO_DERRUBADO =
  "Sua sessão foi encerrada porque esta conta foi acessada em outro dispositivo.";

// De quanto em quanto tempo a aba confere a sessão vigente quando o Realtime não entrega.
export const INTERVALO_CONFERENCIA_MS = 60_000;

/**
 * Marca esta sessão como a vigente do usuário. Chamado assim que o app tem sessão.
 * Devolve true se conseguiu gravar; false em erro (offline, RLS) — nesse caso o app
 * segue funcionando, só não derruba as outras sessões.
 */
export async function registrarSessao(
  usuarioId: string,
  sessionId: string
): Promise<boolean> {
  const { error } = await supabase.from("sessoes_ativas").upsert(
    {
      usuario_id: usuarioId,
      session_id: sessionId,
      atualizado_em: new Date().toISOString(),
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: "usuario_id" }
  );
  if (error) {
    console.warn("[sessao-unica] não deu para registrar a sessão:", error.message);
    return false;
  }
  return true;
}

/**
 * Qual é a sessão vigente do usuário no banco.
 * `null` = não deu para saber (erro de rede, ou linha ainda não existe) — quem chama
 * NÃO deve deslogar nesse caso, porque errar para o lado de derrubar sem motivo é pior.
 */
export async function sessaoVigente(usuarioId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("sessoes_ativas")
    .select("session_id")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) {
    console.warn("[sessao-unica] não deu para conferir a sessão:", error.message);
    return null;
  }
  return (data as { session_id: string } | null)?.session_id ?? null;
}
