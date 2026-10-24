import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Cadastro de Promoções — histórico das campanhas de Compra e de Transferência.
// Mesmo conceito dos Modelos de Bônus: cadastra uma vez e depois vincula ao lançamento.
const sb = supabase as any;

export interface PromocaoInput {
  id?: string;
  nome: string;
  tipo: "compra" | "transferencia";
  programa_estoque_id?: string | null;     // promoção de compra: um único programa
  origens: string[];                       // promoção de transferência: vários programas
  destinos: string[];
  bonus_pct?: number;                      // fração: 0.30 = 30% (só transferência)
  bonus_maximo?: number | null;            // teto de milhas bonificadas por conta; null = sem teto
  vigencia_inicio?: string | null;         // "YYYY-MM-DDTHH:mm"
  vigencia_fim?: string | null;
  link_regulamento?: string | null;
  informacoes?: string | null;
  ativo?: boolean;
}

export function usePromocoes() {
  return useQuery({ queryKey: ["promocoes"], queryFn: async () => {
    const { data, error } = await sb
      .from("promocoes")
      .select(
        "*, programa:programas_estoque!programa_estoque_id(nome), promocao_programas(programa_estoque_id, papel, programas_estoque(id, nome))"
      )
      .order("vigencia_inicio", { ascending: false })
      .limit(5000);
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

export function useSalvarPromocao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: PromocaoInput) => {
      const ehCompra = p.tipo === "compra";
      const payload = {
        nome: (p.nome || "").trim(),
        tipo: p.tipo,
        // compra guarda um único programa; transferência guarda as listas em promocao_programas
        programa_estoque_id: ehCompra ? (p.programa_estoque_id || null) : null,
        // bônus e teto só existem na promoção de transferência
        bonus_pct: ehCompra ? 0 : (Number(p.bonus_pct) || 0),
        bonus_maximo: ehCompra ? null : (p.bonus_maximo ?? null),
        vigencia_inicio: p.vigencia_inicio || null,
        vigencia_fim: p.vigencia_fim || null,
        link_regulamento: p.link_regulamento || null,
        informacoes: p.informacoes || null,
        ativo: p.ativo ?? true,
      };
      let promocaoId = p.id;
      if (promocaoId) {
        const { error } = await sb.from("promocoes").update(payload).eq("id", promocaoId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("promocoes").insert(payload).select("id").single();
        if (error) throw error;
        promocaoId = data.id;
      }
      // Programas de origem e destino: substitui o conjunto
      await sb.from("promocao_programas").delete().eq("promocao_id", promocaoId);
      if (!ehCompra) {
        const linhas = [
          ...(p.origens ?? []).map((programa_estoque_id) => ({ promocao_id: promocaoId, programa_estoque_id, papel: "origem" })),
          ...(p.destinos ?? []).map((programa_estoque_id) => ({ promocao_id: promocaoId, programa_estoque_id, papel: "destino" })),
        ];
        if (linhas.length) {
          const { error } = await sb.from("promocao_programas").insert(linhas);
          if (error) throw error;
        }
      }
      return { id: promocaoId };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promocoes"] }),
  });
}

export function useExcluirPromocao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("promocoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promocoes"] }),
  });
}

/**
 * Bônus da transferência com o teto da promoção aplicado.
 *
 * O teto é de MILHAS BONIFICADAS e vale por conta, somando tudo o que a promoção já
 * bonificou naquela conta durante a vigência (ex.: promo que bonifica no máximo 30.000 —
 * transferir 100.000 com 30% credita 30.000; transferir 110.000 credita 30.000, não 33.000,
 * e o excedente entra sem bônus).
 */
export function bonusComTeto(
  base: number,                 // milhas que recebem bônus (transferida + carrinho)
  pct: number,                  // fração: 0.30 = 30%
  teto: number | null | undefined,
  jaBonificado: number = 0,     // milhas já bonificadas pela promoção nessa conta
): { bonus: number; limitado: boolean; restante: number | null } {
  const cheio = Math.round((Math.round(Number(base) || 0)) * (Number(pct) || 0));
  if (teto == null) return { bonus: cheio, limitado: false, restante: null };
  const restante = Math.max(0, Math.round(teto) - Math.round(jaBonificado || 0));
  const bonus = Math.min(cheio, restante);
  return { bonus, limitado: bonus < cheio, restante };
}

// Ids dos programas de origem / destino de uma promoção de transferência.
// Lista vazia = a promoção vale para qualquer programa.
export function programasDaPromocao(p: any, papel: "origem" | "destino"): string[] {
  return (p?.promocao_programas ?? [])
    .filter((x: any) => x.papel === papel)
    .map((x: any) => x.programa_estoque_id);
}
export function nomesProgramasDaPromocao(p: any, papel: "origem" | "destino"): string {
  const nomes = (p?.promocao_programas ?? [])
    .filter((x: any) => x.papel === papel)
    .map((x: any) => x.programas_estoque?.nome)
    .filter(Boolean)
    .sort((a: string, b: string) => a.localeCompare(b, "pt-BR"));
  return nomes.length ? nomes.join(", ") : "Todos";
}

// Vigente hoje? (sem vigência = sempre vigente)
export function promocaoVigente(p: any, agora: Date = new Date()): boolean {
  const ini = p?.vigencia_inicio ? new Date(p.vigencia_inicio) : null;
  const fim = p?.vigencia_fim ? new Date(p.vigencia_fim) : null;
  if (ini && agora < ini) return false;
  if (fim && agora > fim) return false;
  return true;
}
