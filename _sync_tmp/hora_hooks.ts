import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Assinaturas de Clube + Bônus + geração de Previsão no Estoque
// ---------------------------------------------------------------------------

export interface BonusInput {
  id?: string;
  pontos: number;
  frequencia_meses: number; // 0 = única vez
  repeticoes: number;
  primeira_entrada: string | null;
  descricao?: string | null;
}
export interface AssinaturaInput {
  id?: string;
  conta_id: string;
  programa_id?: string | null;
  programa_estoque_id?: string | null;
  plano?: string | null;
  credito_base: number;
  periodicidade_meses: number;
  valor_parcela: number;
  dia_vencimento: number | null;
  cartao_id: string | null;
  cartao_virtual?: string | null;
  assinante_desde: string | null;
  status: string;
  ativo: boolean;
  observacao?: string | null;
  bonus: BonusInput[];
  acoes?: { id?: string; titulo: string; data: string }[];
  historico?: { id?: string; data: string; descricao: string }[];
}

// Soma N meses a uma data ISO (YYYY-MM-DD), fixando no último dia do mês quando o dia não existe.
function addMonthsISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}
function isoHoje(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
// Próxima data de vencimento (>= hoje) para um dia do mês.
function proximaDataVencto(dia: number): string {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const cand = `${y}-${String(m + 1).padStart(2, "0")}-${String(Math.min(dia, lastDay)).padStart(2, "0")}`;
  return cand < isoHoje() ? addMonthsISO(cand, 1) : cand;
}

const sb = supabase as any;

export function useAssinaturas() {
  return useQuery({ queryKey: ["assinaturas"], queryFn: async () => {
    const { data, error } = await sb
      .from("assinaturas")
      .select("*, contas(codigo, nome), programas(nome), programas_estoque(nome), cartoes(codigo, nome, titular)")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

// Carrega os bônus de uma assinatura (usado ao abrir a edição).
export async function getBonusDaAssinatura(assinaturaId: string): Promise<BonusInput[]> {
  const { data, error } = await sb
    .from("assinatura_bonus")
    .select("id, pontos, frequencia_meses, repeticoes, primeira_entrada, descricao")
    .eq("assinatura_id", assinaturaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BonusInput[];
}

// Carrega o histórico de mudanças de uma assinatura, para a edição.
export async function getHistoricoDaAssinatura(assinaturaId: string): Promise<{ id: string; data: string; descricao: string }[]> {
  const { data, error } = await sb
    .from("assinatura_historico")
    .select("id, data, descricao")
    .eq("assinatura_id", assinaturaId)
    .order("data", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

// Carrega as próximas ações (pendências pendentes) de uma assinatura, para a edição.
export async function getAcoesDaAssinatura(assinaturaId: string): Promise<{ id: string; titulo: string; data: string }[]> {
  const { data, error } = await sb
    .from("pendencias")
    .select("id, titulo, data_prevista")
    .eq("origem_tabela", "assinaturas").eq("origem_id", assinaturaId).eq("tipo", "acao").eq("status", "pendente")
    .order("data_prevista", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((x: any) => ({ id: x.id, titulo: x.titulo, data: x.data_prevista }));
}

// Salva a assinatura, substitui os bônus e regenera a PREVISÃO (movimentos previstos e não
// confirmados). Movimentos já confirmados nunca são tocados.
export function useSalvarAssinatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: AssinaturaInput) => {
      // Prioriza o programa de estoque; resolve o programa (emissao) canonico para as colunas legadas
      let programaEstoqueId = a.programa_estoque_id ?? null;
      let programaId = a.programa_id ?? null;
      if (!programaEstoqueId && programaId) {
        const { data: progRow } = await sb.from("programas").select("programa_estoque_id").eq("id", programaId).single();
        programaEstoqueId = (progRow as any)?.programa_estoque_id ?? null;
      }
      if (!programaId && programaEstoqueId) {
        const { data: progRows } = await sb.from("programas").select("id").eq("programa_estoque_id", programaEstoqueId).order("nome").limit(1);
        programaId = (progRows?.[0] as any)?.id ?? null;
      }
      if (!programaId) throw new Error("Programa de estoque sem programa de emissao vinculado.");
      const payload = {
        conta_id: a.conta_id, programa_id: programaId, programa_estoque_id: programaEstoqueId, plano: a.plano ?? null,
        credito_base: Math.round(a.credito_base || 0), periodicidade_meses: a.periodicidade_meses || 1,
        valor_parcela: a.valor_parcela || 0, dia_vencimento: a.dia_vencimento ?? null,
        cartao_id: a.cartao_id || null, cartao_virtual: a.cartao_virtual ?? null,
        assinante_desde: a.assinante_desde || null,
        status: a.status || "ativo", ativo: a.ativo, observacao: a.observacao ?? null,
      };
      let assinaturaId = a.id;
      if (assinaturaId) {
        const { error } = await sb.from("assinaturas").update(payload).eq("id", assinaturaId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("assinaturas").insert(payload).select("id").single();
        if (error) throw error;
        assinaturaId = data.id;
      }

      // Substitui os bônus
      await sb.from("assinatura_bonus").delete().eq("assinatura_id", assinaturaId);
      const bonusValidos = (a.bonus ?? []).filter((b) => (b.pontos || 0) > 0);
      let bonusSalvos: any[] = [];
      if (bonusValidos.length) {
        const { data, error } = await sb.from("assinatura_bonus").insert(
          bonusValidos.map((b) => ({
            assinatura_id: assinaturaId,
            pontos: Math.round(b.pontos || 0),
            frequencia_meses: b.frequencia_meses || 0,
            repeticoes: Math.max(1, b.repeticoes || 1),
            primeira_entrada: b.primeira_entrada || null,
            descricao: b.descricao ?? null,
          }))
        ).select("id, pontos, frequencia_meses, repeticoes, primeira_entrada, descricao");
        if (error) throw error;
        bonusSalvos = data ?? [];
      }

      // Regenera previsão: remove os movimentos previstos e NÃO confirmados desta assinatura
      await sb.from("estoque_movimentos").delete()
        .eq("assinatura_id", assinaturaId).eq("previsto", true).eq("confirmado", false);

      const movimentos: any[] = [];
      // Crédito base recorrente (horizonte de ~12 meses)
      if ((payload.credito_base || 0) > 0 && payload.dia_vencimento) {
        const passo = payload.periodicidade_meses || 1;
        const ocorrencias = Math.min(12, Math.max(1, Math.round(12 / passo)));
        const inicio = proximaDataVencto(payload.dia_vencimento);
        for (let k = 0; k < ocorrencias; k++) {
          movimentos.push({
            conta_id: a.conta_id, programa_id: programaId, programa_estoque_id: programaEstoqueId,
            data: addMonthsISO(inicio, k * passo), tipo: "assinatura",
            pontos: payload.credito_base, origem: a.plano ? `Assinatura ${a.plano}` : "Assinatura",
            assinatura_id: assinaturaId, previsto: true, confirmado: false,
          });
        }
      }
      // Bônus (cada item gera N ocorrências)
      for (const b of bonusSalvos) {
        if (!b.primeira_entrada || (b.pontos || 0) <= 0) continue;
        const freq = b.frequencia_meses || 0;
        const reps = freq === 0 ? 1 : Math.max(1, b.repeticoes || 1);
        for (let k = 0; k < reps; k++) {
          movimentos.push({
            conta_id: a.conta_id, programa_id: programaId, programa_estoque_id: programaEstoqueId,
            data: addMonthsISO(b.primeira_entrada, k * freq), tipo: "bonus",
            pontos: Math.round(b.pontos || 0),
            // Usa o NOME do bônus (quando veio de um modelo); senão, rótulo genérico pela frequência.
            origem: b.descricao || (freq === 0 ? "Bônus único" : freq === 1 ? "Bônus mensal" : `Bônus a cada ${freq} meses`),
            assinatura_id: assinaturaId, assinatura_bonus_id: b.id, previsto: true, confirmado: false,
          });
        }
      }
      if (movimentos.length) {
        const { error } = await sb.from("estoque_movimentos").insert(movimentos);
        if (error) throw error;
      }

      // Histórico de mudanças do plano (substitui o conjunto salvo)
      await sb.from("assinatura_historico").delete().eq("assinatura_id", assinaturaId);
      const histValido = (a.historico ?? []).filter((h) => (h.descricao || "").trim() && h.data);
      if (histValido.length) {
        const { error } = await sb.from("assinatura_historico").insert(histValido.map((h) => ({
          assinatura_id: assinaturaId, data: h.data, descricao: h.descricao.trim(),
        })));
        if (error) throw error;
      }

      // Próximas ações -> central de pendências (substitui as PENDENTES desta assinatura)
      await sb.from("pendencias").delete()
        .eq("origem_tabela", "assinaturas").eq("origem_id", assinaturaId).eq("tipo", "acao").eq("status", "pendente");
      const acoesValidas = (a.acoes ?? []).filter((x) => (x.titulo || "").trim() && x.data);
      if (acoesValidas.length) {
        const { error } = await sb.from("pendencias").insert(acoesValidas.map((x) => ({
          tipo: "acao", titulo: x.titulo.trim(), data_prevista: x.data, status: "pendente",
          conta_id: a.conta_id, programa_id: programaId, programa_estoque_id: programaEstoqueId,
          origem_tabela: "assinaturas", origem_id: assinaturaId,
        })));
        if (error) throw error;
      }

      return { id: assinaturaId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assinaturas"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentos"] });
    },
  });
}

export function useDeleteAssinatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // remove previsões não confirmadas ligadas à assinatura (confirmadas permanecem no extrato)
      await sb.from("estoque_movimentos").delete()
        .eq("assinatura_id", id).eq("confirmado", false);
      const { error } = await sb.from("assinaturas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assinaturas"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentos"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Estoque de Milhas (livro de movimentos) + reconciliação com o saldo lido
// ---------------------------------------------------------------------------

export function useEstoqueMovimentos() {
  return useQuery({ queryKey: ["estoque-movimentos"], queryFn: async () => {
    const { data, error } = await sb
      .from("estoque_movimentos")
      .select("*, contas(codigo, nome), programas_estoque(nome)")
      .order("data", { ascending: true })
      .limit(10000);
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

// Programas vinculados a cada conta (ativos E inativos) — para filtrar o seletor de Programa no Estoque.
export function useContaProgramasList() {
  return useQuery({ queryKey: ["conta-programas-list"], queryFn: async () => {
    const { data, error } = await sb
      .from("conta_programas")
      .select("conta_id, programa_id, programa_estoque_id, ativo, programas(nome), programas_estoque(nome)")
      .limit(20000);
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

// Saldos lidos por (conta, programa) — a "verdade" raspada do programa (conta_programas.saldo_milhas).
export function useSaldosLidos() {
  return useQuery({ queryKey: ["saldos-lidos"], queryFn: async () => {
    const { data, error } = await sb
      .from("conta_programas")
      .select("conta_id, programa_id, programa_estoque_id, saldo_milhas, saldo_atualizado_em")
      .limit(10000);
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

export function useConfirmarMovimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("estoque_movimentos")
        .update({ confirmado: true, previsto: false, confirmado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque-movimentos"] }),
  });
}

// Confirma um lançamento previsto podendo editar pontos e valor, com motivo obrigatório.
export function useConfirmarMovimentoEditado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id: string; data?: string | null; pontos: number; valor: number | null;
      plano?: string | null; cartao_codigo?: string | null; cartao_final?: string | null; motivo?: string | null; hora?: string | null;
    }) => {
      const upd: any = {
        pontos: Math.round(p.pontos || 0),
        valor: p.valor,
        plano: p.plano || null,
        cartao_codigo: p.cartao_codigo || null,
        cartao_final: p.cartao_final || null,
        confirmado: true,
        previsto: false,
        confirmado_em: new Date().toISOString(),
      };
      if (p.data) upd.data = p.data;
      if (p.hora) upd.hora = p.hora;
      if (p.motivo && p.motivo.trim()) upd.descricao = p.motivo.trim();
      const { error } = await sb.from("estoque_movimentos").update(upd).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque-movimentos"] }),
  });
}

export function useAdicionarMovimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: {
      conta_id: string; programa_estoque_id: string; data: string; tipo: string;
      pontos: number; descricao?: string | null; origem?: string | null; hora?: string | null;
    }) => {
      const { error } = await sb.from("estoque_movimentos").insert({
        conta_id: m.conta_id, programa_estoque_id: m.programa_estoque_id, data: m.data, tipo: m.tipo,
        pontos: Math.round(m.pontos || 0), descricao: m.descricao ?? null, origem: m.origem ?? null, hora: m.hora ?? null,
        previsto: false, confirmado: true, confirmado_em: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque-movimentos"] }),
  });
}

export function useExcluirMovimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("estoque_movimentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque-movimentos"] }),
  });
}

/**
 * Devolve um movimento de assinatura/bônus para a Conferência Clubes:
 * volta a ser uma previsão pendente (pode ser confirmada de novo).
 * Usado no lugar da exclusão no Acompanhamento do estoque.
 */
export function useDesconfirmarMovimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("estoque_movimentos")
        .update({ confirmado: false, previsto: true, confirmado_em: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque-movimentos"] }),
  });
}

// ---------------------------------------------------------------------------
// Planos de Clube por programa (plano, valor e milhas) — usados na assinatura
// ---------------------------------------------------------------------------

export interface PlanoClube {
  id: string;
  programa_id?: string | null;
  programa_estoque_id?: string | null;
  nome: string;
  valor: number;
  milhas: number;
  ativo: boolean;
  observacao?: string | null;
}

export function usePlanosClube() {
  return useQuery({ queryKey: ["planos-clube"], queryFn: async () => {
    const { data, error } = await sb.from("planos_clube").select("*, programas(nome), programas_estoque(nome)").order("nome");
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

export function useUpsertPlanoClube() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<PlanoClube> & { id?: string }) => {
      const payload = {
        // grava por estoque; o gatilho no banco preenche o programa (emissao) canonico
        programa_id: (p as any).programa_estoque_id ? null : (p.programa_id ?? null),
        programa_estoque_id: (p as any).programa_estoque_id ?? null,
        nome: (p.nome || "").trim(),
        valor: Number(p.valor) || 0,
        milhas: Math.round(Number(p.milhas) || 0),
        ativo: p.ativo ?? true,
        observacao: p.observacao ?? null,
      };
      if (p.id) {
        const { error } = await sb.from("planos_clube").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("planos_clube").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planos-clube"] }),
  });
}

export function useDeletePlanoClube() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("planos_clube").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planos-clube"] }),
  });
}

// ---------------------------------------------------------------------------
// Modelos de Bônus (padrões reutilizáveis para aplicar nas assinaturas)
// ---------------------------------------------------------------------------

export interface BonusModelo {
  id: string;
  nome: string;
  pontos: number;
  frequencia_meses: number;
  repeticoes: number;
  ativo: boolean;
  programa_id?: string | null;
  programa_estoque_id?: string | null;
  observacao?: string | null;
}

export function useBonusModelos() {
  return useQuery({ queryKey: ["bonus-modelos"], queryFn: async () => {
    const { data, error } = await sb.from("bonus_modelos").select("*, programas(nome), programas_estoque(nome)").order("nome");
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

export function useUpsertBonusModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<BonusModelo> & { id?: string }) => {
      const payload = {
        nome: (m.nome || "").trim(),
        pontos: Math.round(m.pontos || 0),
        frequencia_meses: m.frequencia_meses || 0,
        repeticoes: Math.max(1, m.repeticoes || 1),
        ativo: m.ativo ?? true,
        programa_id: (m as any).programa_estoque_id ? null : (m.programa_id || null),
        programa_estoque_id: (m as any).programa_estoque_id || null,
        observacao: m.observacao ?? null,
      };
      if (m.id) {
        const { error } = await sb.from("bonus_modelos").update(payload).eq("id", m.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("bonus_modelos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonus-modelos"] }),
  });
}

export function useDeleteBonusModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("bonus_modelos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonus-modelos"] }),
  });
}

// ---------------------------------------------------------------------------
// Estoque — Compras / Transferências / Perdas (abas da Planilha Mestre)
// Cada uma é a fonte da verdade da sua "aba" e entra direto no estoque:
//   compra  -> +qtde na (conta, programa)
//   perda   -> -qtde na (conta, programa)
//   transf. -> -qtde_transferida no remetente e +qtde_recebida no recebedor
// ---------------------------------------------------------------------------

// Custo por milheiro (custo total ÷ milhares de milhas). 0 quando não há qtde.
export function custoMilheiro(custoTotal: number, qtde: number): number {
  const q = Number(qtde) || 0;
  if (q <= 0) return 0;
  return (Number(custoTotal) || 0) / (q / 1000);
}

// ---------- COMPRAS ----------
export interface CompraInput {
  id?: string;
  data: string;
  conta_id: string;
  programa_estoque_id: string;
  qtde: number;
  custo_total: number | null;
  num_parcelas: number | null;
  forma_pagamento: string | null;
  valor_parcela: number | null;
  hora?: string | null;
  operacao?: string | null;
  descricao?: string | null;
}

export function useEstoqueCompras() {
  return useQuery({ queryKey: ["estoque-compras"], queryFn: async () => {
    const { data, error } = await sb
      .from("estoque_compras")
      .select("*, contas(codigo, nome), programas_estoque(nome)")
      .order("data", { ascending: false })
      .limit(10000);
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

export function useSalvarCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: CompraInput) => {
      const qtde = Math.round(c.qtde || 0);
      const payload = {
        data: c.data, conta_id: c.conta_id, programa_estoque_id: c.programa_estoque_id,
        qtde,
        custo_total: c.custo_total,
        num_parcelas: c.num_parcelas,
        forma_pagamento: c.forma_pagamento ?? null,
        valor_parcela: c.valor_parcela,
        custo_milheiro: custoMilheiro(c.custo_total || 0, qtde),
        hora: c.hora || null,
        operacao: c.operacao ?? null,
        descricao: c.descricao ?? null,
      };
      if (c.id) {
        const { error } = await sb.from("estoque_compras").update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("estoque_compras").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-compras"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentos"] });
    },
  });
}

export function useExcluirCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("estoque_compras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque-compras"] }),
  });
}

// ---------- TRANSFERÊNCIAS ----------
export interface TransferenciaInput {
  id?: string;
  data: string;
  conta_remetente_id: string;
  conta_recebedora_id: string;
  programa_estoque_remetente_id: string;
  programa_estoque_recebedor_id: string;
  qtde_transferida: number;
  bonus: number;             // fração: 0.35 = 35%
  custo_total: number | null;
  num_parcelas: number | null;
  forma_pagamento: string | null;
  valor_parcela: number | null;
  hora?: string | null;
  descricao?: string | null;
}

// Quantidade que chega no destino = transferida + bônus.
export function qtdeRecebida(transferida: number, bonus: number): number {
  const t = Math.round(Number(transferida) || 0);
  return Math.round(t * (1 + (Number(bonus) || 0)));
}

export function useEstoqueTransferencias() {
  return useQuery({ queryKey: ["estoque-transferencias"], queryFn: async () => {
    const { data, error } = await sb
      .from("estoque_transferencias")
      .select(
        "*, remetente:contas!conta_remetente_id(codigo, nome), recebedora:contas!conta_recebedora_id(codigo, nome), prog_remetente:programas_estoque!programa_estoque_remetente_id(nome), prog_recebedor:programas_estoque!programa_estoque_recebedor_id(nome)"
      )
      .order("data", { ascending: false })
      .limit(10000);
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

export function useSalvarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: TransferenciaInput) => {
      const transferida = Math.round(t.qtde_transferida || 0);
      const recebida = qtdeRecebida(transferida, t.bonus);
      const payload = {
        data: t.data,
        conta_remetente_id: t.conta_remetente_id,
        conta_recebedora_id: t.conta_recebedora_id,
        programa_estoque_remetente_id: t.programa_estoque_remetente_id,
        programa_estoque_recebedor_id: t.programa_estoque_recebedor_id,
        qtde_transferida: transferida,
        bonus: Number(t.bonus) || 0,
        qtde_recebida: recebida,
        custo_total: t.custo_total,
        num_parcelas: t.num_parcelas,
        forma_pagamento: t.forma_pagamento ?? null,
        valor_parcela: t.valor_parcela,
        custo_milheiro: custoMilheiro(t.custo_total || 0, recebida),
        hora: t.hora || null,
        descricao: t.descricao ?? null,
      };
      if (t.id) {
        const { error } = await sb.from("estoque_transferencias").update(payload).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("estoque_transferencias").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-transferencias"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentos"] });
    },
  });
}

export function useExcluirTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("estoque_transferencias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque-transferencias"] }),
  });
}

// ---------- PERDAS ----------
export interface PerdaInput {
  id?: string;
  data: string;
  conta_id: string;
  programa_estoque_id: string;
  qtde: number;
  hora?: string | null;
  operacao?: string | null;
  descricao?: string | null;
}

export function useEstoquePerdas() {
  return useQuery({ queryKey: ["estoque-perdas"], queryFn: async () => {
    const { data, error } = await sb
      .from("estoque_perdas")
      .select("*, contas(codigo, nome), programas_estoque(nome)")
      .order("data", { ascending: false })
      .limit(10000);
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

export function useSalvarPerda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: PerdaInput) => {
      const payload = {
        data: p.data, conta_id: p.conta_id, programa_estoque_id: p.programa_estoque_id,
        qtde: Math.round(p.qtde || 0),
        hora: p.hora || null,
        operacao: p.operacao ?? null,
        descricao: p.descricao ?? null,
      };
      if (p.id) {
        const { error } = await sb.from("estoque_perdas").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("estoque_perdas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-perdas"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentos"] });
    },
  });
}

export function useExcluirPerda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("estoque_perdas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque-perdas"] }),
  });
}

// ---------------------------------------------------------------------------
// Programas Estoque (cadastro) + vínculo com o Programa de Emissão
// Estoque = onde as milhas moram (ex.: "Azul" agrupa Azul Liminar/Viagens/Interline).
// Cada Programa de Emissão aponta para 1 Programa Estoque (programas.programa_estoque_id).
// ---------------------------------------------------------------------------

export function useProgramasEstoque() {
  return useQuery({ queryKey: ["programas-estoque"], queryFn: async () => {
    const { data, error } = await sb.from("programas_estoque").select("*").order("nome");
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

export function useUpsertProgramaEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { id?: string; nome: string; ativo?: boolean }) => {
      const payload = { nome: (m.nome || "").trim(), ativo: m.ativo ?? true };
      if (m.id) {
        const { error } = await sb.from("programas_estoque").update(payload).eq("id", m.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("programas_estoque").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programas-estoque"] }),
  });
}

export function useDeleteProgramaEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("programas_estoque").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programas-estoque"] }),
  });
}

// Programas de emissão com o vínculo de estoque (para exibir/editar em Configurações).
export function useProgramasComEstoque() {
  return useQuery({ queryKey: ["programas-com-estoque"], queryFn: async () => {
    const { data, error } = await sb
      .from("programas")
      .select("id, nome, observacao, programa_estoque_id, usar_nas_emissoes, programas_estoque(nome)")
      .order("nome");
    if (error) throw error;
    return (data ?? []) as any[];
  }});
}

export function useVincularProgramaEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { programa_id: string; programa_estoque_id: string | null }) => {
      const { error } = await sb.from("programas").update({ programa_estoque_id: m.programa_estoque_id }).eq("id", m.programa_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["programas-com-estoque"] });
      qc.invalidateQueries({ queryKey: ["programas"] });
    },
  });
}
