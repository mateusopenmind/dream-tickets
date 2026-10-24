// Filtros + carga de dados compartilhados pelos dashboards de faturamento
// (Dashboard › Faturamento e Dashboard › Faturamento diário).
//
// Fonte única: os dois dashboards usam a MESMA consulta, o MESMO conjunto de filtros
// e os MESMOS padrões. Mudou um filtro aqui, muda nas duas telas.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/hooks/usePerfil";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import {
  type RegistroDash, ehEmissao, mesesDe, valoresDe, periodoDe, fmtNum, fmtDataBR, mesLabel,
} from "@/lib/dashboardFaturamento";

export const ALL = "__all";
/** Origem padrão dos dashboards: próprias + terceirizadas (decidido com o Mateus em 13/10/2026). */
export const ORIGEM_PADRAO = ALL;

/** Campo de valor em reais: quando o tipo é "milhas", converte pelo preço do milheiro. */
const emReais = (valor: unknown, tipo: unknown, milheiro: number) =>
  tipo === "milhas" ? ((Number(valor) || 0) * milheiro) / 1000 : Number(valor) || 0;

const SELECT_EMISSAO =
  "id_emissao, owner_id, data_emissao, hora, programa, nome_operacao, emissor, status_pix, " +
  "passageiros_qtd, milhas_cobrado, preco_milheiro, preco_total, " +
  "taxas_cobrado, taxas_tipo, outros_cobrado, outros_tipo, " +
  "bagagens_cobrado, bagagens_tipo, assentos_cobrado, assentos_tipo, clientes(codigo)";

function mapear(r: any, origem: "propria" | "terceirizada"): RegistroDash {
  const milheiro = Number(r.preco_milheiro) || 0;
  return {
    data: (r.data_emissao ?? "").slice(0, 10),
    hora: r.hora ?? null,
    programa: r.programa ?? "",
    operacao: r.nome_operacao ?? "",
    emissor: r.emissor ?? "",
    cliente: r.clientes?.codigo ?? "",
    pax: Number(r.passageiros_qtd) || 0,
    milhas: Number(r.milhas_cobrado) || 0,
    preco_milheiro: milheiro,
    taxas: emReais(r.taxas_cobrado, r.taxas_tipo, milheiro),
    // O contrato do dashboard tem um único campo "outros"; no app são três colunas.
    outros:
      emReais(r.outros_cobrado, r.outros_tipo, milheiro) +
      emReais(r.bagagens_cobrado, r.bagagens_tipo, milheiro) +
      emReais(r.assentos_cobrado, r.assentos_tipo, milheiro),
    total: Number(r.preco_total) || 0,
    status: r.status_pix ?? "",
    origem,
    id_emissao: r.id_emissao ?? "",
  };
}

/** Carrega emissões próprias + terceirizadas já no formato do dashboard. */
export function useRegistrosDash() {
  const { user } = useAuth();
  const { data: perfil } = usePerfil();
  // Mesma regra das demais telas: operador enxerga só o que ele lançou.
  const veTudo = perfil?.papel === "super_admin" || perfil?.papel === "admin";

  return useQuery({
    queryKey: ["dashboard-faturamento", user?.id, perfil?.papel],
    enabled: !!perfil,
    queryFn: async (): Promise<RegistroDash[]> => {
      const PAGE = 1000;
      const carregar = async (tabela: "emissoes" | "emissoes_terceirizadas") => {
        const out: any[] = [];
        for (let ini = 0; ; ini += PAGE) {
          let q = supabase.from(tabela).select(SELECT_EMISSAO).order("data_emissao", { ascending: true }).range(ini, ini + PAGE - 1);
          if (!veTudo && user) q = q.eq("owner_id", user.id);
          const { data, error } = await q;
          if (error) throw error;
          out.push(...(data ?? []));
          if (!data || data.length < PAGE) break;
        }
        return out;
      };
      const [proprias, terceirizadas] = await Promise.all([carregar("emissoes"), carregar("emissoes_terceirizadas")]);
      return [
        ...proprias.map((r) => mapear(r, "propria")),
        ...terceirizadas.map((r) => mapear(r, "terceirizada")),
      ].filter((r) => !!r.data);
    },
  });
}

/** Estado dos filtros + linhas filtradas + período efetivo. */
export function useFiltrosFaturamento(base: RegistroDash[]) {
  const [fOrigem, setFOrigem] = useState(ORIGEM_PADRAO);
  const [fPrograma, setFPrograma] = useState(ALL);
  const [fEmissor, setFEmissor] = useState(ALL);
  const [fCliente, setFCliente] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  const rows = useMemo(() => {
    return base.filter((r) => {
      if (fOrigem !== ALL && r.origem !== fOrigem) return false;
      if (fPrograma !== ALL && r.programa !== fPrograma) return false;
      if (fEmissor !== ALL && r.emissor !== fEmissor) return false;
      if (fCliente !== ALL && r.cliente !== fCliente) return false;
      if (fStatus !== ALL && r.status !== fStatus) return false;
      if (fDe && r.data < fDe) return false;
      if (fAte && r.data > fAte) return false;
      return true;
    });
  }, [base, fOrigem, fPrograma, fEmissor, fCliente, fStatus, fDe, fAte]);

  const mesesDisponiveis = useMemo(() => mesesDe(base), [base]);

  const temFiltro =
    fOrigem !== ORIGEM_PADRAO || fPrograma !== ALL || fEmissor !== ALL || fCliente !== ALL || fStatus !== ALL || !!fDe || !!fAte;
  const limpar = () => {
    setFOrigem(ORIGEM_PADRAO); setFPrograma(ALL); setFEmissor(ALL); setFCliente(ALL); setFStatus(ALL); setFDe(""); setFAte("");
  };

  const mesSelecionado = useMemo(() => {
    if (!fDe && !fAte) return "";
    if (fDe && fAte && fDe.slice(0, 7) === fAte.slice(0, 7)) {
      const [y, m] = fDe.split("-");
      const ultimo = new Date(Number(y), Number(m), 0).getDate();
      if (fDe.slice(8) === "01" && fAte.slice(8) === String(ultimo).padStart(2, "0")) return fDe.slice(0, 7);
    }
    return null;
  }, [fDe, fAte]);
  const selecionarMes = (m: string) => {
    if (!m) { setFDe(""); setFAte(""); return; }
    const [y, mm] = m.split("-");
    const ultimo = new Date(Number(y), Number(mm), 0).getDate();
    setFDe(`${m}-01`);
    setFAte(`${m}-${String(ultimo).padStart(2, "0")}`);
  };

  // Período efetivo (dados ∩ filtro de data) — usado nos calendários e na série diária.
  const limites = useMemo<[string, string] | null>(() => {
    const p = periodoDe(rows);
    if (!p) return null;
    return [fDe && fDe > p[0] ? fDe : p[0], fAte && fAte < p[1] ? fAte : p[1]];
  }, [rows, fDe, fAte]);

  return {
    base, rows, limites, mesesDisponiveis, temFiltro, limpar, mesSelecionado, selecionarMes,
    fOrigem, setFOrigem, fPrograma, setFPrograma, fEmissor, setFEmissor,
    fCliente, setFCliente, fStatus, setFStatus, fDe, setFDe, fAte, setFAte,
  };
}

export type FiltrosFaturamentoState = ReturnType<typeof useFiltrosFaturamento>;

/** Card de filtros — idêntico nos dois dashboards. */
export function FiltrosFaturamento({ f }: { f: FiltrosFaturamentoState }) {
  const opts = (campo: keyof RegistroDash) => valoresDe(f.base, campo);
  const emissoes = useMemo(() => f.rows.filter(ehEmissao).length, [f.rows]);

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Select value={f.fOrigem} onValueChange={f.setFOrigem}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="propria">Emissões próprias</SelectItem>
            <SelectItem value="terceirizada">Terceirizadas</SelectItem>
            <SelectItem value={ALL}>Próprias + terceirizadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={f.fPrograma} onValueChange={f.setFPrograma}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Programa" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Todos programas</SelectItem>{opts("programa").map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={f.fEmissor} onValueChange={f.setFEmissor}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Emissor" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Todos emissores</SelectItem>{opts("emissor").map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={f.fCliente} onValueChange={f.setFCliente}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Todos clientes</SelectItem>{opts("cliente").map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={f.fStatus} onValueChange={f.setFStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status Pix" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Todos status</SelectItem>{opts("status").map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">De</label>
          <Input type="date" value={f.fDe} onChange={(e) => f.setFDe(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Até</label>
          <Input type="date" value={f.fAte} onChange={(e) => f.setFAte(e.target.value)} className="w-40" />
        </div>
        {f.temFiltro && <Button variant="ghost" size="sm" onClick={f.limpar}><X className="mr-1 h-4 w-4" />Limpar</Button>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["", ...f.mesesDisponiveis].map((m) => (
          <button
            key={m || "todos"}
            onClick={() => f.selecionarMes(m)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              f.mesSelecionado === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {m ? mesLabel(m) : "Todos os meses"}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {fmtNum(f.rows.length)} registros · {fmtNum(emissoes)} emissões
        {f.limites && ` · ${fmtDataBR(f.limites[0])} a ${fmtDataBR(f.limites[1])}`}
      </p>
    </Card>
  );
}
