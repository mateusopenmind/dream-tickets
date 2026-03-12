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
      if (c.id) {
        const { error } = await supabase.from("clientes").update({ codigo: c.codigo, nome_fantasia: c.nome_fantasia }).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert({ codigo: c.codigo, nome_fantasia: c.nome_fantasia });
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
export function useUpsertConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: ContaInsert & { id?: string }) => {
      if (c.id) {
        const { error } = await supabase.from("contas").update({ codigo: c.codigo, nome: c.nome }).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contas").insert({ codigo: c.codigo, nome: c.nome });
        if (error) throw error;
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
      if (c.id) {
        const { error } = await supabase.from("cartoes").update({ codigo: c.codigo, nome: c.nome }).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cartoes").insert({ codigo: c.codigo, nome: c.nome });
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
        const { error } = await supabase.from("emissoes").update(rest as EmissaoUpdate).eq("id", id);
        if (error) throw error;
      } else {
        delete payload.id;
        const { error } = await supabase.from("emissoes").insert(payload);
        if (error) throw error;
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
