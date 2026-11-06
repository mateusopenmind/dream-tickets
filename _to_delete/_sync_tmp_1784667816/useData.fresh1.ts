import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
type ClienteInsert = Database["public"]["Tables"]["clientes"]["Insert"];
type Conta = Database["public"]["Tables"]["contas"]["Row"];
type ContaInsert = Database["public"]["Tables"]["contas"]["Insert"];
type Cartao = Database["public"]["Tables"]["cartoes"]["Row"];
type CartaoInsert = Database["public"]["Tables"]["cartoes"]["Insert"];
type Emissao = Database["public"]["Tables"]["emissoes"]["Row"];
type EmissaoInsert = Database["public"]["Tables"]["emissoes"]["Insert"];
type EmissaoUpdate = Database["public"]["Tables"]["emissoes"]["Update"];
type Fornecedor = Database["public"]["Tables"]["fornecedores"]["Row"];
type FornecedorInsert = Database["public"]["Tables"]["fornecedores"]["Insert"];
type EmissaoTerceirizada = Database["public"]["Tables"]["emissoes_terceirizadas"]["Row"];
type EmissaoTerceirizadaInsert = Database["public"]["Tables"]["emissoes_terceirizadas"]["Insert"];
type EmissaoTerceirizadaUpdate = Database["public"]["Tables"]["emissoes_terceirizadas"]["Update"];
type Programa = Database["public"]["Tables"]["programas"]["Row"];
type Operacao = Database["public"]["Tables"]["operacoes"]["Row"];
type Origem = Database["public"]["Tables"]["origens"]["Row"];
type Emissor = Database["public"]["Tables"]["emissores"]["Row"];
type Banco = Database["public"]["Tables"]["bancos"]["Row"];
type RecebimentoAvulso = Database["public"]["Tables"]["recebimentos_avulsos"]["Row"];
type RecebimentoAvulsoInsert = Database["public"]["Tables"]["recebimentos_avulsos"]["Insert"];
type Reembolso = Database["public"]["Tables"]["reembolsos"]["Row"];
type ReembolsoInsert = Database["public"]["Tables"]["reembolsos"]["Insert"];
type ReembolsoUpdate = Database["public"]["Tables"]["reembolsos"]["Update"];
type TaxaQueimaCpf = Database["public"]["Tables"]["taxas_queima_cpf"]["Row"];
type TaxaQueimaCpfInsert = Database["public"]["Tables"]["taxas_queima_cpf"]["Insert"];

// Lookup tables
export function useBancos() {
  return useQuery({ queryKey: ["bancos"], queryFn: async () => {
    const { data, error } = await supabase.from("bancos").select("*").order("nome");
    if (error) throw error;
    return data as Banco[];
  }});
}
export function useProgramas() {
  return useQuery({ queryKey: ["programas"], queryFn: async () => {
    const { data, error } = await supabase.from("programas").select("*").order("nome");
    if (error) throw error;
    return data as Programa[];
  }});
}
export function useOperacoes() {
  return useQuery({ queryKey: ["operacoes"], queryFn: async () => {
    const { data, error } = await supabase.from("operacoes").select("*").order("nome");
    if (error) throw error;
    return data as Operacao[];
  }});
}
export function useOrigens() {
  return useQuery({ queryKey: ["origens"], queryFn: async () => {
    const { data, error } = await supabase.from("origens").select("*").order("nome");
    if (error) throw error;
    return data as Origem[];
  }});
}
export function useEmissores() {
  return useQuery({ queryKey: ["emissores"], queryFn: async () => {
    const { data, error } = await supabase.from("emissores").select("*").order("nome");
    if (error) throw error;
    return data as Emissor[];
  }});
}
export function useOrigensClientes() {
  return useQuery({ queryKey: ["origens_clientes"], queryFn: async () => {
    const { data, error } = await supabase.from("origens_clientes").select("*").order("nome");
    if (error) throw error;
    return data as Database["public"]["Tables"]["origens_clientes"]["Row"][];
  }});
}

// Clientes
export function useClientes() {
  return useQuery({ queryKey: ["clientes"], queryFn: async () => {
    const { data, error } = await supabase.from("clientes").select("*").order("nome_fantasia");
    if (error) throw error;
    return data as Cliente[];
  }});
}
export function useUpsertCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: ClienteInsert & { id?: string }) => {
      const payload = {
        codigo: c.codigo, nome_fantasia: c.nome_fantasia, razao_social: c.razao_social ?? null,
        cnpj_cpf: c.cnpj_cpf ?? null, cep: c.cep ?? null, endereco: c.endereco ?? null,
        contato: c.contato ?? null, fone: c.fone ?? null, email: c.email ?? null,
        origem: c.origem ?? null, grupo: c.grupo ?? null,
        nivel: c.nivel ?? null, grupo_criado: c.grupo_criado ?? null,
        tipo_pessoa: c.tipo_pessoa ?? null, logradouro: c.logradouro ?? null, numero: c.numero ?? null,
        complemento: c.complemento ?? null, bairro: c.bairro ?? null, municipio: c.municipio ?? null,
        uf: c.uf ?? null, codigo_ibge: c.codigo_ibge ?? null,
        inscricao_municipal: c.inscricao_municipal ?? null, inscricao_estadual: c.inscricao_estadual ?? null,
        telegram: c.telegram ?? null,
      };
      if (c.id) {
        const { error } = await supabase.from("clientes").update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  });
}
export function useDeleteCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  });
}

// Contas
export function useContas() {
  return useQuery({ queryKey: ["contas"], queryFn: async () => {
    const { data, error } = await supabase.from("contas").select("*").order("nome");
    if (error) throw error;
    return data as Conta[];
  }});
}

// Programas vinculados a cada conta: { [conta_id]: Set<nome_programa> }
export function useContaProgramas() {
  return useQuery({ queryKey: ["conta-programas-map"], queryFn: async () => {
    // só estoques ATIVOS aparecem na emissão (inativos mantêm saldo mas não são ofertados)
    // mapa: conta_id -> Set<programa_estoque_id>
    const { data, error } = await supabase.from("conta_programas").select("conta_id, ativo, programa_estoque_id").eq("ativo", true).limit(5000);
    if (error) throw error;
    const map: Record<string, Set<string>> = {};
    (data ?? []).forEach((r: any) => {
      if (!r.programa_estoque_id) return;
      (map[r.conta_id] ||= new Set()).add(r.programa_estoque_id);
    });
    return map;
  }});
}
export function useUpsertConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: ContaInsert & { id?: string; numero_smiles?: string }) => {
      const payload = {
        codigo: c.codigo, nome: c.nome, nascimento: c.nascimento || null, cpf: c.cpf ?? null,
        fone: c.fone ?? null, email: c.email ?? null, tipo: c.tipo ?? null, pix_envio: c.pix_envio ?? null,
        numero_smiles: (c as any).numero_smiles ?? null,
      };
      if (c.id) {
        const { data, error } = await supabase.from("contas").update(payload).eq("id", c.id).select("id").single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from("contas").insert(payload).select("id").single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contas"] }),
  });
}
export function useDeleteConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contas"] }),
  });
}

// Cartoes
export function useCartoes() {
  return useQuery({ queryKey: ["cartoes"], queryFn: async () => {
    const { data, error } = await supabase.from("cartoes").select("*").order("nome");
    if (error) throw error;
    return data as Cartao[];
  }});
}
export function useUpsertCartao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: CartaoInsert & { id?: string }) => {
      const payload = {
        codigo: c.codigo, nome: c.nome, bandeira: c.bandeira ?? null, titular: c.titular ?? null,
        cpf_cnpj: c.cpf_cnpj ?? null,
        dia_fechamento: c.dia_fechamento ? Number(c.dia_fechamento) : null,
        dia_vencimento: c.dia_vencimento ? Number(c.dia_vencimento) : null,
        limite: c.limite ? Number(c.limite) : null,
      };
      if (c.id) {
        const { error } = await supabase.from("cartoes").update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cartoes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartoes"] }),
  });
}
export function useDeleteCartao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cartoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartoes"] }),
  });
}

// Emissoes
export function useEmissoes() {
  return useQuery({ queryKey: ["emissoes"], queryFn: async () => {
    // PostgREST corta em 1000 linhas por requisição — paginar para trazer todas.
    const sel = "*, clientes(codigo, nome_fantasia), contas(codigo, nome), cartoes(codigo, nome)";
    const PAGE = 1000;
    const all: any[] = [];
    for (let ini = 0; ; ini += PAGE) {
      const { data, error } = await supabase
        .from("emissoes")
        .select(sel)
        .order("data_emissao", { ascending: false })
        .range(ini, ini + PAGE - 1);
      if (error) throw error;
      all.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return all;
  }});
}
// Mapa emissao_id -> tipo do reembolso (total | parcial | taxas), por tabela de origem.
// Usado para exibir o status "Ativa" (verde) ou "Reembolso X" (amarelo) na lista de emissões.
export function useReembolsosPorEmissao(tabelaOrigem: "emissoes" | "emissoes_terceirizadas" = "emissoes") {
  return useQuery({ queryKey: ["reembolsos_por_emissao", tabelaOrigem], queryFn: async () => {
    const map: Record<string, string> = {};
    const { data, error } = await supabase
      .from("reembolsos")
      .select("emissao_id, tipo, created_at")
      .eq("tabela_origem", tabelaOrigem)
      .order("created_at", { ascending: true })
      .limit(10000);
    if (error) throw error;
    // Ordenado por created_at asc -> o último a sobrescrever é o mais recente.
    for (const r of data ?? []) if (r.emissao_id) map[r.emissao_id] = r.tipo;
    return map;
  }});
}
// Resolve o programa_id (FK) a partir do nome do programa, para gravar junto nas
// emissões/terceirizadas/reembolsos (o lado emissão continua guardando o nome também).
async function resolverProgramaId(payload: any) {
  if (payload && typeof payload.programa === "string" && payload.programa.trim()) {
    const { data } = await supabase.from("programas").select("id").eq("nome", payload.programa).maybeSingle();
    payload.programa_id = (data as any)?.id ?? null;
  }
}

export function useUpsertEmissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: EmissaoInsert & { id?: string }) => {
      const payload: any = { ...e };
      delete payload.clientes;
      delete payload.contas;
      delete payload.cartoes;
      await resolverProgramaId(payload);
      if (e.id) {
        const { id, ...rest } = payload;
        const { data, error } = await supabase.from("emissoes").update(rest as EmissaoUpdate).eq("id", id).select("*, clientes(codigo,nome_fantasia), contas(codigo,nome), cartoes(codigo,nome)").single();
        if (error) throw error;
        return data;
      } else {
        delete payload.id;
        const { data, error } = await supabase.from("emissoes").insert(payload).select("*, clientes(codigo,nome_fantasia), contas(codigo,nome), cartoes(codigo,nome)").single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emissoes"] }),
  });
}
export function useDeleteEmissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("emissoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emissoes"] }),
  });
}

// Fornecedores (cadastro para Emissões Terceirizadas)
export function useFornecedores() {
  return useQuery({ queryKey: ["fornecedores"], queryFn: async () => {
    const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
    if (error) throw error;
    return data as Fornecedor[];
  }});
}
export function useUpsertFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: FornecedorInsert & { id?: string }) => {
      const payload = {
        codigo: f.codigo ?? null, nome: f.nome, chave_pix: f.chave_pix ?? null,
        ativo: f.ativo ?? true,
      };
      if (f.id) {
        const { error } = await supabase.from("fornecedores").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fornecedores"] }),
  });
}
export function useDeleteFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fornecedores"] }),
  });
}

// Emissoes Terceirizadas
export function useEmissoesTerceirizadas() {
  return useQuery({ queryKey: ["emissoes_terceirizadas"], queryFn: async () => {
    // PostgREST corta em 1000 linhas por requisição — paginar para trazer todas.
    const sel = "*, clientes(codigo, nome_fantasia), fornecedores(codigo, nome)";
    const PAGE = 1000;
    const all: any[] = [];
    for (let ini = 0; ; ini += PAGE) {
      const { data, error } = await supabase
        .from("emissoes_terceirizadas")
        .select(sel)
        .order("data_emissao", { ascending: false })
        .range(ini, ini + PAGE - 1);
      if (error) throw error;
      all.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return all;
  }});
}
export function useUpsertEmissaoTerceirizada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: EmissaoTerceirizadaInsert & { id?: string }) => {
      const payload: any = { ...e };
      delete payload.clientes;
      delete payload.fornecedores;
      // custo_total e total_milhas são colunas geradas — nunca enviar no payload
      delete payload.custo_total;
      delete payload.total_milhas;
      delete payload.data_hora_emissao;
      await resolverProgramaId(payload);
      if (e.id) {
        const { id, ...rest } = payload;
        const { data, error } = await supabase.from("emissoes_terceirizadas").update(rest as EmissaoTerceirizadaUpdate).eq("id", id).select("*, clientes(codigo,nome_fantasia), fornecedores(codigo,nome)").single();
        if (error) throw error;
        return data;
      } else {
        delete payload.id;
        const { data, error } = await supabase.from("emissoes_terceirizadas").insert(payload).select("*, clientes(codigo,nome_fantasia), fornecedores(codigo,nome)").single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emissoes_terceirizadas"] }),
  });
}
export function useDeleteEmissaoTerceirizada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("emissoes_terceirizadas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emissoes_terceirizadas"] }),
  });
}

// Recebimentos Avulsos (recebíveis manuais lançados pelo admin, vinculados a UMA emissão)
export interface EmissaoEmAberto {
  tabela_origem: "emissoes" | "emissoes_terceirizadas";
  id: string;
  id_emissao: string;
  cliente_id: string | null;
  cliente_codigo: string;
  cliente_nome: string;
  programa: string;
  localizador: string;
  data_emissao: string | null;
  preco_total: number;
  valor_recebido: number;
  saldo_pendente: number;
}

// Emissões (normais + terceirizadas) com status EM ABERTO — usadas no seletor de lançamento.
// Só entram as que ainda têm saldo pendente (preço total menos o que já foi recebido).
export function useEmissoesEmAberto() {
  return useQuery({
    queryKey: ["emissoes-em-aberto"],
    queryFn: async (): Promise<EmissaoEmAberto[]> => {
      const [normais, terceirizadas] = await Promise.all([
        supabase
          .from("emissoes")
          .select("id, id_emissao, cliente_id, programa, localizador, data_emissao, preco_total, valor_recebido, clientes(codigo, nome_fantasia)")
          .eq("status_pix", "EM ABERTO")
          .limit(5000),
        supabase
          .from("emissoes_terceirizadas")
          .select("id, id_emissao, cliente_id, programa, localizador, data_emissao, preco_total, valor_recebido, clientes(codigo, nome_fantasia)")
          .eq("status_pix", "EM ABERTO")
          .limit(5000),
      ]);
      if (normais.error) throw normais.error;
      if (terceirizadas.error) throw terceirizadas.error;
      const montar = (rows: any[], tabela: "emissoes" | "emissoes_terceirizadas"): EmissaoEmAberto[] =>
        (rows ?? []).map((r) => {
          const total = Number(r.preco_total) || 0;
          const recebido = Number(r.valor_recebido) || 0;
          return {
            tabela_origem: tabela,
            id: r.id,
            id_emissao: r.id_emissao ?? "",
            cliente_id: r.cliente_id,
            cliente_codigo: (r.clientes as any)?.codigo ?? "",
            cliente_nome: (r.clientes as any)?.nome_fantasia ?? "",
            programa: r.programa ?? "",
            localizador: r.localizador ?? "",
            data_emissao: r.data_emissao,
            preco_total: total,
            valor_recebido: recebido,
            saldo_pendente: Math.max(0, Math.round((total - recebido) * 100) / 100),
          };
        });
      return [...montar(normais.data, "emissoes"), ...montar(terceirizadas.data, "emissoes_terceirizadas")]
        .filter((e) => e.saldo_pendente > 0)
        .sort((a, b) => (a.data_emissao ?? "").localeCompare(b.data_emissao ?? ""));
    },
  });
}

// Cobranças em aberto (normais + terceirizadas) para o relatório por cliente.
export interface CobrancaAberta {
  tabela_origem: "emissoes" | "emissoes_terceirizadas" | "reembolsos";
  id: string;
  id_emissao: string;
  cliente_id: string | null;
  cliente_codigo: string;
  cliente_nome: string;
  data_emissao: string | null;
  hora: string | null;
  localizador: string;
  programa: string;
  nome_operacao: string;
  data_voo_ida: string | null;
  preco_total: number;
}

export function useCobrancasEmAberto() {
  return useQuery({
    queryKey: ["cobrancas-em-aberto"],
    queryFn: async (): Promise<CobrancaAberta[]> => {
      const sel =
        "id, id_emissao, cliente_id, data_emissao, hora, localizador, programa, nome_operacao, data_voo_ida, preco_total, clientes(codigo, nome_fantasia)";
      const [normais, terceirizadas, reembs] = await Promise.all([
        supabase.from("emissoes").select(sel).eq("status_pix", "EM ABERTO").limit(5000),
        supabase.from("emissoes_terceirizadas").select(sel).eq("status_pix", "EM ABERTO").limit(5000),
        supabase.from("reembolsos")
          .select("id, reembolso_id, cliente_id, created_at, localizador, programa, tipo, pax_qtd, preco_total, clientes(codigo, nome_fantasia)")
          .eq("status_pix", "EM ABERTO").limit(5000),
      ]);
      if (normais.error) throw normais.error;
      if (terceirizadas.error) throw terceirizadas.error;
      if (reembs.error) throw reembs.error;
      const montar = (rows: any[], tabela: "emissoes" | "emissoes_terceirizadas"): CobrancaAberta[] =>
        (rows ?? []).map((r) => ({
          tabela_origem: tabela,
          id: r.id,
          id_emissao: r.id_emissao ?? "",
          cliente_id: r.cliente_id,
          cliente_codigo: (r.clientes as any)?.codigo ?? "",
          cliente_nome: (r.clientes as any)?.nome_fantasia ?? "",
          data_emissao: r.data_emissao,
          hora: r.hora,
          localizador: r.localizador ?? "",
          programa: r.programa ?? "",
          nome_operacao: r.nome_operacao ?? "",
          data_voo_ida: r.data_voo_ida,
          preco_total: Number(r.preco_total) || 0,
        }));
      // Reembolsos a cobrar do cliente (Pix em aberto) — Operação = "Reembolso Total/Parcial/Taxas".
      const tipoLabel = (t: string) => (t === "parcial" ? "Parcial" : t === "taxas" ? "Taxas" : "Total");
      const montarReemb = (rows: any[]): CobrancaAberta[] =>
        (rows ?? []).map((r) => ({
          tabela_origem: "reembolsos" as const,
          id: r.id,
          id_emissao: r.reembolso_id ?? "",
          cliente_id: r.cliente_id,
          cliente_codigo: (r.clientes as any)?.codigo ?? "",
          cliente_nome: (r.clientes as any)?.nome_fantasia ?? "",
          data_emissao: r.created_at ? String(r.created_at).slice(0, 10) : null,
          hora: r.created_at ? new Date(r.created_at).toTimeString().slice(0, 5) : null,
          localizador: r.localizador ?? "",
          programa: r.programa ?? "",
          nome_operacao: "Reembolso " + tipoLabel(r.tipo) + (r.tipo === "parcial" && r.pax_qtd ? ` (${r.pax_qtd} pax)` : ""),
          data_voo_ida: null,
          preco_total: Number(r.preco_total) || 0,
        }));
      return [...montar(normais.data as any[], "emissoes"), ...montar(terceirizadas.data as any[], "emissoes_terceirizadas"), ...montarReemb(reembs.data as any[])]
        .sort((a, b) =>
          `${a.data_emissao ?? ""} ${a.hora ?? ""}`.localeCompare(`${b.data_emissao ?? ""} ${b.hora ?? ""}`)
        );
    },
  });
}

export function useRecebimentosAvulsos() {
  return useQuery({
    queryKey: ["recebimentos-avulsos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos_avulsos")
        .select("*, clientes(codigo, nome_fantasia)")
        .order("data_prevista", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as (RecebimentoAvulso & { clientes: { codigo: string; nome_fantasia: string } | null })[];
    },
  });
}

// Gera N parcelas (previstas) de uma vez para a emissão escolhida.
// Se a emissão tinha um Pix ativo (cobrança em aberto), cancela esse Pix no banco
// silenciosamente (sem marcar a emissão como CANCELADO e sem avisar o cliente por WhatsApp) —
// a partir de agora o recebimento passa a ser acompanhado manualmente pelas parcelas do avulso.
export function useCriarParcelas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      tabela_origem: "emissoes" | "emissoes_terceirizadas";
      emissao_id: string;
      parcelas: { numero_parcela: number; total_parcelas: number; data_prevista: string; valor: number; banco?: string }[];
      observacao?: string;
    }): Promise<{ pixCancelado: boolean }> => {
      const payload: RecebimentoAvulsoInsert[] = params.parcelas.map((p) => ({
        tabela_origem: params.tabela_origem,
        emissao_id: params.emissao_id,
        numero_parcela: p.numero_parcela,
        total_parcelas: p.total_parcelas,
        data_prevista: p.data_prevista,
        valor: p.valor,
        banco: p.banco || null,
        observacao: params.observacao || null,
        status: "previsto",
      }));
      const { error } = await supabase.from("recebimentos_avulsos").insert(payload);
      if (error) throw error;

      let pixCancelado = false;
      try {
        const { data: emissao } = await supabase
          .from(params.tabela_origem)
          .select("forma_cobranca, status_pix, pix_txid")
          .eq("id", params.emissao_id)
          .single();
        if (emissao?.forma_cobranca === "pix" && emissao?.status_pix === "EM ABERTO" && emissao?.pix_txid) {
          const { data: resp, error: fnError } = await supabase.functions.invoke("disparar-n8n", {
            body: { acao: "cancelar", tabela: params.tabela_origem, emissao_id: params.emissao_id, silencioso: true },
          });
          if (!fnError && !(resp as any)?.error) pixCancelado = true;
        }
      } catch { /* não bloqueia o lançamento das parcelas se o cancelamento do Pix falhar */ }

      return { pixCancelado };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos-avulsos"] });
      qc.invalidateQueries({ queryKey: ["emissoes-em-aberto"] });
      qc.invalidateQueries({ queryKey: ["emissoes"] });
      qc.invalidateQueries({ queryKey: ["emissoes_terceirizadas"] });
      qc.invalidateQueries({ queryKey: ["relatorio-recebimentos"] });
    },
  });
}

// Marca uma parcela como recebida (data, banco e valor final — o gatilho no banco recalcula a emissão).
export function useMarcarRecebido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; data_recebimento: string; banco: string; valor?: number }) => {
      const payload: any = { status: "recebido", data_recebimento: params.data_recebimento, banco: params.banco };
      if (params.valor != null) payload.valor = params.valor;
      const { error } = await supabase.from("recebimentos_avulsos").update(payload).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos-avulsos"] });
      qc.invalidateQueries({ queryKey: ["emissoes-em-aberto"] });
      qc.invalidateQueries({ queryKey: ["emissoes"] });
      qc.invalidateQueries({ queryKey: ["emissoes_terceirizadas"] });
      qc.invalidateQueries({ queryKey: ["relatorio-recebimentos"] });
    },
  });
}

// Resumo (contagem/valores) dos recebimentos avulsos vinculados a uma emissão — usado para avisar
// ANTES de cancelar/excluir (chama uma função no banco que ignora a RLS de admin, pois o aviso
// precisa aparecer para qualquer usuário, mesmo quem não acessa a tela Recebimentos Avulsos).
export async function buscarResumoRecebimentosAvulsos(
  tabela_origem: "emissoes" | "emissoes_terceirizadas",
  emissao_id: string
) {
  const { data, error } = await supabase.rpc("resumo_recebimentos_avulsos", {
    p_tabela_origem: tabela_origem,
    p_emissao_id: emissao_id,
  });
  if (error) throw error;
  return data as { total: number; recebidos: number; valor_total: number; valor_recebido: number };
}

export function useExcluirRecebimentoAvulso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recebimentos_avulsos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos-avulsos"] });
      qc.invalidateQueries({ queryKey: ["emissoes-em-aberto"] });
      qc.invalidateQueries({ queryKey: ["emissoes"] });
      qc.invalidateQueries({ queryKey: ["emissoes_terceirizadas"] });
      qc.invalidateQueries({ queryKey: ["relatorio-recebimentos"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Taxa Queima CPF (config: valor por CPF/pax por programa — ex.: Latam 120, Smiles 90)
// ---------------------------------------------------------------------------
export function useTaxasQueimaCpf() {
  return useQuery({ queryKey: ["taxas_queima_cpf"], queryFn: async () => {
    const { data, error } = await supabase.from("taxas_queima_cpf").select("*").order("programa");
    if (error) throw error;
    return data as TaxaQueimaCpf[];
  }});
}
export function useUpsertTaxaQueimaCpf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: TaxaQueimaCpfInsert & { id?: string }) => {
      const payload = { programa: (t.programa || "").trim(), valor: Number(t.valor) || 0, updated_at: new Date().toISOString() };
      if (t.id) {
        const { error } = await supabase.from("taxas_queima_cpf").update(payload).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("taxas_queima_cpf").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["taxas_queima_cpf"] }),
  });
}
export function useDeleteTaxaQueimaCpf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("taxas_queima_cpf").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["taxas_queima_cpf"] }),
  });
}

// ---------------------------------------------------------------------------
// Reembolsos (estorno de emissões — NÃO altera a emissão, apenas registra)
// ---------------------------------------------------------------------------

// Busca emissões (normais) pelo Localizador, trazendo os dados compactos usados no reembolso.
// Localizador não é único (recobranças/erros), então retorna todas as correspondências,
// da mais recente para a mais antiga.
export async function buscarEmissoesPorLocalizador(localizador: string) {
  const loc = (localizador || "").trim().toUpperCase();
  if (!loc) return [];
  const { data, error } = await supabase
    .from("emissoes")
    .select("*, clientes(codigo, nome_fantasia), contas(codigo, nome), cartoes(codigo, nome)")
    .eq("localizador", loc)
    .order("data_emissao", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as any[];
}

// Pesquisa ao vivo (typeahead): busca por Localizador OU ID em emissoes E emissoes_terceirizadas.
// Usa a RPC SECURITY DEFINER buscar_emissoes_reembolso — no reembolso QUALQUER usuário pode
// achar/selecionar a emissão de outro (o reembolso criado continua sendo do criador).
// Cada resultado já vem marcado com _tabela e com clientes/contas/cartoes/fornecedores embutidos.
export async function pesquisarEmissoesLocalizador(termo: string) {
  const t = (termo || "").trim().toUpperCase();
  if (t.length < 2) return [];
  const { data, error } = await supabase.rpc("buscar_emissoes_reembolso", { p_termo: t });
  if (error) throw error;
  return (data ?? []) as any[];
}

// Carrega uma emissão (de qualquer usuário) para exibição na edição do reembolso.
export async function getEmissaoReembolso(id: string, tabela: string) {
  const { data, error } = await supabase.rpc("get_emissao_reembolso", { p_id: id, p_tabela: tabela });
  if (error) throw error;
  return (data ?? null) as any;
}

export function useReembolsos() {
  return useQuery({ queryKey: ["reembolsos"], queryFn: async () => {
    const { data, error } = await supabase
      .from("reembolsos")
      .select("*, clientes(codigo, nome_fantasia), cartoes(codigo, nome)")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    return (data ?? []) as (Reembolso & {
      clientes: { codigo: string; nome_fantasia: string } | null;
      cartoes: { codigo: string; nome: string } | null;
    })[];
  }});
}
export function useUpsertReembolso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: ReembolsoInsert & { id?: string }) => {
      const payload: any = { ...r };
      delete payload.clientes;
      delete payload.cartoes;
      await resolverProgramaId(payload);
      if (r.id) {
        const { id, ...rest } = payload;
        const { data, error } = await supabase.from("reembolsos").update(rest as ReembolsoUpdate).eq("id", id)
          .select("*, clientes(codigo,nome_fantasia), cartoes(codigo,nome)").single();
        if (error) throw error;
        return data;
      } else {
        delete payload.id;
        const { data, error } = await supabase.from("reembolsos").insert(payload)
          .select("*, clientes(codigo,nome_fantasia), cartoes(codigo,nome)").single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reembolsos"] }); qc.invalidateQueries({ queryKey: ["reembolsos_por_emissao"] }); },
  });
}
export function useDeleteReembolso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reembolsos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reembolsos"] }); qc.invalidateQueries({ queryKey: ["reembolsos_por_emissao"] }); },
  });
}

// Reembolsos a pagar ao cliente (sentido = 'reembolsar', a_pagar = true) — controle tipo Pagamento Facial.
export function useReembolsosAPagar() {
  return useQuery({
    queryKey: ["reembolsos-a-pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reembolsos")
        .select("*, clientes(codigo, nome_fantasia), cartoes(codigo, nome)")
        .eq("a_pagar", true)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as (Reembolso & {
        clientes: { codigo: string; nome_fantasia: string } | null;
        cartoes: { codigo: string; nome: string } | null;
      })[];
    },
  });
}

export function useMarcarReembolsoPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { ids: string[]; data_pagamento: string; banco_pagamento?: string | null }) => {
      const payload: ReembolsoUpdate = {
        pago: true,
        data_pagamento: params.data_pagamento,
        banco_pagamento: params.banco_pagamento || null,
      };
      const { error } = await supabase.from("reembolsos").update(payload).in("id", params.ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reembolsos-a-pagar"] });
      qc.invalidateQueries({ queryKey: ["reembolsos"] });
    },
  });
}

// Marca um status booleano de reembolso (ex.: cartao_reembolsado, milhas_reembolsadas) + data.
export function useMarcarReembolsoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { ids: string[]; campo: string; dataField: string; data: string }) => {
      const payload: any = { [p.campo]: true, [p.dataField]: p.data };
      const { error } = await supabase.from("reembolsos").update(payload).in("id", p.ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reembolsos"] });
      qc.invalidateQueries({ queryKey: ["reembolsos-a-pagar"] });
    },
  });
}

// Desfaz um status booleano de reembolso (volta para pendente).
export function useDesfazerReembolsoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; campo: string; dataField: string }) => {
      const payload: any = { [p.campo]: false, [p.dataField]: null };
      const { error } = await supabase.from("reembolsos").update(payload).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reembolsos"] });
      qc.invalidateQueries({ queryKey: ["reembolsos-a-pagar"] });
    },
  });
}

// Desfaz o pagamento (volta o reembolso para Pendentes) — NÃO exclui o reembolso.
export function useDesfazerPagamentoReembolso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reembolsos")
        .update({ pago: false, data_pagamento: null, banco_pagamento: null } as ReembolsoUpdate)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reembolsos-a-pagar"] });
      qc.invalidateQueries({ queryKey: ["reembolsos"] });
    },
  });
}

// Remove um reembolso pendente da fila de Pagamento de Reembolsos SEM excluir o reembolso.
// Zera a_pagar (some da tela de pagamento); o reembolso continua existindo e editável.
// Ao reeditar/salvar, o upsert recalcula a_pagar conforme a liquidação.
export function useRemoverReembolsoDaFila() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reembolsos")
        .update({ a_pagar: false } as ReembolsoUpdate)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reembolsos-a-pagar"] });
      qc.invalidateQueries({ queryKey: ["reembolsos"] });
    },
  });
}
