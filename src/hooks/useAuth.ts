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
