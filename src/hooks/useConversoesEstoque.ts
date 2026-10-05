import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Conversão da transferência: sai da ORIGEM e entra no DESTINO.
// fator = quantos pontos da origem valem 1 ponto/milha do destino (paridade padrão, sem bônus).
const sb = supabase as any;

export type Destinatario = "mesmo_cpf" | "qualquer_cpf";

// De quem pode ser a conta que recebe
export const DESTINATARIOS: { v: Destinatario; l: string }[] = [
  { v: "mesmo_cpf", l: "Mesmo CPF" },
  { v: "qualquer_cpf", l: "Qualquer CPF" },
];
export const destinatarioLabel = (d: string | null | undefined) =>
  DESTINATARIOS.find((x) => x.v === d)?.l ?? "—";

export function useConversoesEstoque() {
  return useQuery({ queryKey: ["programa-estoque-conversoes"], queryFn: async () => {
    const { data, error } = await sb.from("programa_estoque_conversoes").select("*").limit(5000);
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

export function useSalvarConversaoEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { origem_id: string; destino_id: string; fator: number; destinatario?: Destinatario }) => {
      const { error } = await sb.from("programa_estoque_conversoes")
        .upsert({
          origem_id: c.origem_id, destino_id: c.destino_id, fator: c.fator,
          destinatario: c.destinatario ?? "mesmo_cpf",
        }, { onConflict: "origem_id,destino_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programa-estoque-conversoes"] }),
  });
}

// Apagar = esse destino deixa de ter conversão cadastrada para essa origem.
export function useRemoverConversaoEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { origem_id: string; destino_id: string }) => {
      const { error } = await sb.from("programa_estoque_conversoes").delete()
        .eq("origem_id", c.origem_id).eq("destino_id", c.destino_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programa-estoque-conversoes"] }),
  });
}

// Mapa "origemId|destinoId" -> regra completa (fator + destinatário)
export function mapaConversoes(lista: any[] | undefined): Map<string, any> {
  const m = new Map<string, any>();
  (lista ?? []).forEach((c: any) => m.set(`${c.origem_id}|${c.destino_id}`, c));
  return m;
}

// Quanto chega no destino pela paridade (antes do bônus).
export function converterPelaParidade(qtdeOrigem: number, fator: number): number {
  const f = Number(fator) > 0 ? Number(fator) : 1;
  return Math.round((Number(qtdeOrigem) || 0) / f);
}
