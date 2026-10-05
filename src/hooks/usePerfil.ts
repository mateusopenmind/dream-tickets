import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: "super_admin" | "admin" | "operador";
  gl_id: string;
  whatsapp: string;
  ativo: boolean;
}

export function usePerfil() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["perfil", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_usuario")
        .select("id, nome, email, papel, gl_id, whatsapp, ativo")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as Perfil;
    },
  });
}

// Telas que o usuario atual pode ver (super admin ve todas as prontas)
export function useMinhasTelas() {
  const { user } = useAuth();
  const { data: perfil } = usePerfil();
  return useQuery({
    queryKey: ["minhas-telas", user?.id, perfil?.papel],
    enabled: !!user && !!perfil,
    queryFn: async () => {
      if (perfil!.papel === "super_admin") {
        const { data } = await supabase.from("telas").select("chave").eq("pronta", true);
        return new Set((data ?? []).map((t: any) => t.chave));
      }
      const { data } = await supabase
        .from("usuario_telas")
        .select("telas(chave, pronta)")
        .eq("usuario_id", user!.id);
      const chaves = (data ?? [])
        .map((r: any) => r.telas)
        .filter((t: any) => t && t.pronta)
        .map((t: any) => t.chave);
      return new Set(chaves);
    },
  });
}

// Permissão de exclusão: apenas super_admin e admin podem apagar registros.
export function usePodeExcluir() {
  const { data: perfil } = usePerfil();
  return perfil?.papel === "super_admin" || perfil?.papel === "admin";
}

// True para super_admin/admin. Usado, por exemplo, para liberar a edição de uma
// emissão que já tem reembolso — operador não pode mais mexer nela.
export function useEhAdmin() {
  const { data: perfil } = usePerfil();
  return perfil?.papel === "super_admin" || perfil?.papel === "admin";
}
