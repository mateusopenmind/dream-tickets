import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Escuta mudanças de status das emissões em tempo real (Supabase Realtime)
 * e avisa na tela quando um Pix é PAGO ou CANCELADO.
 * A baixa é feita pelos fluxos automáticos (webhook dos bancos + conferência periódica).
 */
export function useAvisoPixPago() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const canal = supabase
      .channel("emissoes-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "emissoes" },
        (payload: any) => {
          const novo = payload.new || {};
          const antigo = payload.old || {};
          if (!novo.id_emissao || novo.status_pix === antigo.status_pix) return;
          if (novo.status_pix === "PAGO") {
            const valor = Number(novo.valor_recebido || novo.preco_total || 0)
              .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            toast.success(`Emissão ${novo.id_emissao}: Pix PAGO! ${valor} recebido.`, { duration: 10000 });
            queryClient.invalidateQueries({ queryKey: ["emissoes"] });
          } else if (novo.status_pix === "CANCELADO") {
            toast.info(`Emissão ${novo.id_emissao}: Pix cancelado. Você pode editar, cobrar novamente ou excluir.`, { duration: 8000 });
            queryClient.invalidateQueries({ queryKey: ["emissoes"] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [queryClient]);
}
