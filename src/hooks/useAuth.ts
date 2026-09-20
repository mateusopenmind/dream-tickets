import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  msAteExpirar,
  limparInicioSessao,
  sessionIdDoToken,
  SESSAO_MAX_HORAS,
  AVISOS_MINUTOS,
} from "@/lib/sessaoExpira";
import {
  registrarSessao,
  sessaoVigente,
  AVISO_DERRUBADO,
  INTERVALO_CONFERENCIA_MS,
} from "@/lib/sessaoUnica";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    limparInicioSessao();
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}

/**
 * Derruba para a tela de login SESSAO_MAX_HORAS depois do login, mesmo com o usuário
 * ativo, avisando alguns minutos antes.
 *
 * Chame UMA vez só, na raiz (AppRoutes) — o `useAuth` é usado em várias telas, e um guard
 * por tela viraria vários timers e vários toasts iguais.
 */
export function useExpiracaoSessao(session: Session | null) {
  // Avisos já dados nesta sessão (5 min, 1 min) — para não repetir a cada conferida.
  const avisados = useRef<{ sid: string | null; minutos: number[] }>({ sid: null, minutos: [] });

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;

    const sid = sessionIdDoToken(token);
    if (avisados.current.sid !== sid) avisados.current = { sid, minutos: [] };

    let ativo = true;

    const conferir = async () => {
      if (!ativo) return;
      const restante = msAteExpirar(token);
      if (restante === null) return; // sem como medir — não mexe na sessão

      if (restante <= 0) {
        ativo = false; // trava antes do await para não deslogar duas vezes
        limparInicioSessao();
        await supabase.auth.signOut();
        toast.error(`Sessão expirada (limite de ${SESSAO_MAX_HORAS} horas). Entre novamente.`, {
          duration: 15000,
        });
        return;
      }

      // Avisa nos marcos configurados, uma vez cada.
      const minutosRestantes = Math.ceil(restante / 60000);
      const marco = AVISOS_MINUTOS.find(
        (m) => minutosRestantes <= m && !avisados.current.minutos.includes(m)
      );
      if (marco != null) {
        avisados.current.minutos.push(marco);
        toast.warning(
          `Sua sessão expira em ${minutosRestantes} ${minutosRestantes === 1 ? "minuto" : "minutos"}. Salve o que estiver fazendo — você vai precisar entrar de novo.`,
          { duration: 20000 }
        );
      }
    };

    conferir();
    // Intervalo em vez de um setTimeout único para o fim: cobre notebook que dormiu e aba
    // em segundo plano, onde timers longos não são confiáveis.
    const id = setInterval(conferir, 30_000);
    const aoVoltar = () => { if (document.visibilityState === "visible") conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      ativo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [session?.access_token]);
}


/**
 * Sessão única por usuário: o login mais recente é o que vale, e as demais sessões do
 * mesmo usuário caem para a tela de login com aviso (ver lib/sessaoUnica.ts).
 *
 * Chame UMA vez só, na raiz (AppRoutes) — mesmo motivo do useExpiracaoSessao: o useAuth
 * roda em várias telas, e um guard por tela viraria vários canais e vários toasts.
 */
export function useSessaoUnica(session: Session | null) {
  const usuarioId = session?.user?.id ?? null;
  // O session_id NÃO muda quando o token é renovado, só num login novo. É por isso que
  // este efeito depende dele, e não do access_token: renovação de token não pode
  // re-registrar a sessão (isso derrubaria de volta quem acabou de entrar).
  const meuSid = sessionIdDoToken(session?.access_token);

  useEffect(() => {
    if (!usuarioId || !meuSid) return;

    let ativo = true;

    const derrubar = async () => {
      if (!ativo) return;
      ativo = false; // trava antes do await para não deslogar duas vezes
      limparInicioSessao();
      await supabase.auth.signOut();
      toast.error(AVISO_DERRUBADO, { duration: 20000 });
    };

    const conferir = async () => {
      if (!ativo) return;
      const vigente = await sessaoVigente(usuarioId);
      // null = não deu para saber (offline, erro): não derruba ninguém no escuro.
      if (!ativo || vigente === null) return;
      if (vigente !== meuSid) await derrubar();
    };

    // 1) Esta sessão passa a ser a vigente — é isso que derruba as outras.
    registrarSessao(usuarioId, meuSid);

    // 2) Realtime na própria linha: quem já estava aberto cai na hora.
    const canal = supabase
      .channel(`sessao-unica-${usuarioId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessoes_ativas",
          filter: `usuario_id=eq.${usuarioId}`,
        },
        (payload) => {
          const vigente = (payload.new as { session_id?: string } | null)?.session_id;
          if (vigente && vigente !== meuSid) derrubar();
        }
      )
      .subscribe();

    // 3) Reserva: rede que bloqueia websocket, aba que dormiu, Realtime fora do ar.
    const id = setInterval(conferir, INTERVALO_CONFERENCIA_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") conferir();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      ativo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
      supabase.removeChannel(canal);
    };
  }, [usuarioId, meuSid]);
}
