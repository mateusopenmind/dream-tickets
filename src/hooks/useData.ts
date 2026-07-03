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
type Programa = Database["public"]["Tables"]["programas"]["Row"];
type Operacao = Database["public"]["Tables"]["operacoes"]["Row"];
type Origem = Database["public"]["Tables"]["origens"]["Row"];
type Emissor = Database["public"]["Tables"]["emissores"]["Row"];

// Lookup tables
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
        tipo_pessoa: c.tipo_pessoa ?? null, logradouro: c.logradouro ?? null, numero: c.numero ?? null,
        complemento: c.complemento ?? null, bairro: c.bairro ?? null, municipio: c.municipio ?? null,
        uf: c.uf ?? null, codigo_ibge: c.codigo_ibge ?? null,
        inscricao_municipal: c.inscricao_municipal ?? null, inscricao_estadual: c.inscricao_estadual ?? null,
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
    // só programas ATIVOS aparecem na emissão (inativos mantêm saldo mas não são ofertados)
    const { data, error } = await supabase.from("conta_programas").select("conta_id, ativo, programas(nome)").eq("ativo", true).limit(5000);
    if (error) throw error;
    const map: Record<string, Set<string>> = {};
    (data ?? []).forEach((r: any) => {
      const nome = (r.programas as any)?.nome;
      if (!nome) return;
      (map[r.conta_id] ||= new Set()).add(nome);
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
    const { data, error } = await supabase
      .from("emissoes")
      .select("*, clientes(codigo, nome_fantasia), contas(codigo, nome), cartoes(codigo, nome)")
      .order("data_emissao", { ascending: false });
    if (error) throw error;
    return data;
  }});
}
export function useUpsertEmissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: EmissaoInsert & { id?: string }) => {
      const payload: any = { ...e };
      delete payload.clientes;
      delete payload.contas;
      delete payload.cartoes;
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
