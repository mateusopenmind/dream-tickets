// Dashboard de Faturamento — reprodução, dentro do app, do dashboard montado pelo
// cliente a partir da planilha (BI/Handoff_Dev/Dashboard_Faturamento.html).
//
// A fonte agora é o banco: cada linha de `emissoes` (e, opcionalmente, de
// `emissoes_terceirizadas`) já é uma operação, com nome_operacao = Emissão,
// Remarcação, Bagagem, Assento, Queima CPFs, Taxa Reembolso ou Upgrade — o mesmo
// desenho da planilha. As regras de cálculo estão em lib/dashboardFaturamento.ts.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/hooks/usePerfil";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AjudaButton } from "@/components/AjudaButton";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { useSort } from "@/hooks/useSort";
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, Loader2, X } from "lucide-react";
import { exportarExcel, type ColunaExcel } from "@/lib/exportarExcel";
import { ColunasEmpilhadas, BarrasHorizontais, Colunas, LinhaArea, type Serie } from "@/components/dashboard/GraficosDash";
import {
  CardTabela, TabelaProgramaMes, TabelaFaixaMes, CalendarioDash, MatrizPctClientes,
} from "@/components/dashboard/TabelasDash";
import {
  type RegistroDash, ehEmissao, resumo, porMes, mesesDe, valoresDe, matrizProgramaMes,
  faixaResumo, faixaPorMes, agrupar, matrizPorMes, topPorFaturamento, porCliente,
  calendario, periodoDe, porSemana, porDia, porDiaDaSemana,
  fmtBRL, fmtBRL2, fmtNum, fmtMilhas, fmtMilK, fmtPct1, fmtDataBR, mesLabel,
  corPrograma, PROG_CORES, CORES_MES, CORES_CLIENTE, ACENTO, acentoDoMes,
  FAIXAS, RGB_VERDE, RGB_SMILES, RGB_LATAM, DOW_LABELS,
} from "@/lib/dashboardFaturamento";

const ALL = "__all";
const POR_PAGINA = 150;
const THDET = "px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

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

export default function DashboardFaturamentoPage() {
  const { user } = useAuth();
  const { data: perfil } = usePerfil();
  // Mesma regra das demais telas: operador enxerga só o que ele lançou.
  const veTudo = perfil?.papel === "super_admin" || perfil?.papel === "admin";

  const [fOrigem, setFOrigem] = useState("propria");
  const [fPrograma, setFPrograma] = useState(ALL);
  const [fEmissor, setFEmissor] = useState(ALL);
  const [fCliente, setFCliente] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  const { data: registros, isLoading } = useQuery({
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

  const base = registros ?? [];

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

  const meses = useMemo(() => mesesDe(rows), [rows]);
  const mesesDisponiveis = useMemo(() => mesesDe(base), [base]);
  const r = useMemo(() => resumo(rows), [rows]);
  const kpisMes = useMemo(() => porMes(rows), [rows]);

  const temFiltro =
    fOrigem !== "propria" || fPrograma !== ALL || fEmissor !== ALL || fCliente !== ALL || fStatus !== ALL || fDe || fAte;
  const limpar = () => {
    setFOrigem("propria"); setFPrograma(ALL); setFEmissor(ALL); setFCliente(ALL); setFStatus(ALL); setFDe(""); setFAte("");
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

  /* ---------------------------------------------------- tabelas e gráficos */

  const mFat = useMemo(() => matrizProgramaMes(rows, meses, "faturamento"), [rows, meses]);
  const mVenda = useMemo(() => matrizProgramaMes(rows, meses, "vendaMilhas"), [rows, meses]);
  const mMilhas = useMemo(() => matrizProgramaMes(rows, meses, "milhas"), [rows, meses]);
  const mEmi = useMemo(() => matrizProgramaMes(rows, meses, "emissoes"), [rows, meses]);
  const mMilPax = useMemo(() => matrizProgramaMes(rows, meses, "milhasPorPax"), [rows, meses]);

  const serieProgMilhas: Serie[] = useMemo(
    () => mMilhas.linhas.map((l, i) => ({ label: l.chave, cor: corPrograma(l.chave, i), valores: l.celulas })),
    [mMilhas],
  );

  const progFat = useMemo(() => agrupar(rows, "programa").sort((a, b) => b.total - a.total), [rows]);
  const emissores = useMemo(() => agrupar(rows, "emissor").sort((a, b) => b.emissoes - a.emissoes), [rows]);
  const emissorMes = useMemo(
    () => matrizPorMes(rows, "emissor", meses, "emissoes", emissores.map((e) => e.chave)),
    [rows, meses, emissores],
  );
  const serieEmissorMes: Serie[] = useMemo(
    () => meses.map((m, j) => ({
      label: mesLabel(m),
      cor: CORES_MES[j % CORES_MES.length],
      valores: emissores.map((_, i) => emissorMes[i]?.[j] ?? 0),
    })),
    [meses, emissores, emissorMes],
  );

  const top15 = useMemo(() => topPorFaturamento(rows, 15), [rows]);
  const nomesTop15 = top15.map((c) => c.cliente);
  const progsTop15 = useMemo(() => {
    const set = new Set(nomesTop15);
    const soma = new Map<string, number>();
    for (const x of rows) if (set.has(x.cliente)) soma.set(x.programa, (soma.get(x.programa) ?? 0) + x.total);
    return [...soma.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [rows, nomesTop15.join("|")]);
  const serieTop15Prog: Serie[] = useMemo(() => {
    const set = new Set(nomesTop15);
    const pos = new Map(nomesTop15.map((c, i) => [c, i]));
    const m = progsTop15.map(() => nomesTop15.map(() => 0));
    const posP = new Map(progsTop15.map((p, i) => [p, i]));
    for (const x of rows) {
      if (!set.has(x.cliente)) continue;
      const i = posP.get(x.programa), j = pos.get(x.cliente);
      if (i === undefined || j === undefined) continue;
      m[i][j] += x.total;
    }
    return progsTop15.map((p, i) => ({ label: p, cor: corPrograma(p, i), valores: m[i] }));
  }, [rows, progsTop15, nomesTop15.join("|")]);

  const top15Mes = useMemo(
    () => matrizPorMes(rows, "cliente", meses, "faturamento", nomesTop15),
    [rows, meses, nomesTop15.join("|")],
  );
  const serieTop15Mes: Serie[] = useMemo(
    () => nomesTop15.map((c, i) => ({ label: c, cor: CORES_CLIENTE[i % CORES_CLIENTE.length], valores: top15Mes[i] ?? [] })),
    [nomesTop15.join("|"), top15Mes],
  );

  // Período efetivo (dados ∩ filtro de data) — usado nos calendários e na série diária.
  const limites = useMemo<[string, string] | null>(() => {
    const p = periodoDe(rows);
    if (!p) return null;
    return [fDe && fDe > p[0] ? fDe : p[0], fAte && fAte < p[1] ? fAte : p[1]];
  }, [rows, fDe, fAte]);

  const semanas = useMemo(() => porSemana(rows), [rows]);
  // Série contínua: inclui os dias sem venda (zerados), para a linha não pular datas.
  const dias = useMemo(() => porDia(rows, limites), [rows, limites]);
  const dow = useMemo(() => porDiaDaSemana(rows), [rows]);

  // Rankings mensais (cards por mês)
  const rankingPorMes = useMemo(
    () => meses.map((m) => {
      const doMes = rows.filter((x) => x.data.slice(0, 7) === m);
      const totalMes = doMes.reduce((s, x) => s + x.total, 0);
      const emiMes = doMes.filter(ehEmissao).length;
      const lista = porCliente(doMes);
      return {
        mes: m,
        totalMes,
        emiMes,
        porFaturamento: [...lista].sort((a, b) => b.faturamento - a.faturamento).slice(0, 15),
        porEmissoes: [...lista].filter((c) => c.emissoes > 0)
          .sort((a, b) => b.emissoes - a.emissoes || b.faturamento - a.faturamento).slice(0, 15),
      };
    }),
    [rows, meses],
  );

  // Matriz % do faturamento mensal — top 15
  const pctTop15 = useMemo(() => {
    const totalPorMes = meses.map((m) => rows.filter((x) => x.data.slice(0, 7) === m).reduce((s, x) => s + x.total, 0));
    const pcts = nomesTop15.map((_, i) => (top15Mes[i] ?? []).map((v, j) => (totalPorMes[j] > 0 ? (v / totalPorMes[j]) * 100 : 0)));
    const totais = top15.map((c) => (r.faturamento > 0 ? (c.faturamento / r.faturamento) * 100 : 0));
    return { pcts, totais };
  }, [meses, rows, top15Mes, nomesTop15.join("|"), top15, r.faturamento]);

  // Calendários
  const calGeral = useMemo(() => calendario(rows, "faturamento", limites), [rows, limites]);
  const calSmiles = useMemo(() => calendario(rows.filter((x) => x.programa === "Smiles"), "milhas", limites), [rows, limites]);
  const calLatam = useMemo(() => calendario(rows.filter((x) => x.programa === "Latam"), "milhas", limites), [rows, limites]);

  // Detalhamento: ordenação clicável na Data (crescente por padrão) + paginação.
  const detalheOrdenado = useSort<RegistroDash>(rows, "data", "asc");
  const detalhe = detalheOrdenado.sorted;
  const pagina = usePagination(detalhe, POR_PAGINA);

  const exportar = () => {
    const cols: ColunaExcel[] = [
      { header: "Emissão", key: "id_emissao" },
      { header: "Data", key: "data", tipo: "data" },
      { header: "Programa", key: "programa" },
      { header: "Operação", key: "operacao" },
      { header: "Emissor", key: "emissor" },
      { header: "Cliente", key: "cliente" },
      { header: "PAX", key: "pax", tipo: "inteiro" },
      { header: "Milhas", key: "milhas", tipo: "inteiro" },
      { header: "Preço/Mil", key: "preco_milheiro", tipo: "decimal" },
      { header: "Taxas", key: "taxas", tipo: "moeda" },
      { header: "Outros", key: "outros", tipo: "moeda" },
      { header: "Total", key: "total", tipo: "moeda" },
      { header: "Status", key: "status" },
      { header: "Origem", key: "origem" },
    ];
    exportarExcel("dashboard-faturamento", cols, detalhe);
  };

  const doTotal = (v: number) => (r.faturamento > 0 ? `${fmtPct1((v / r.faturamento) * 100)} do total` : "—");
  const doFat = (v: number) => (r.faturamento > 0 ? `${fmtPct1((v / r.faturamento) * 100)} do faturamento` : "—");

  const kpis = [
    { l: "Faturamento", v: fmtBRL(r.faturamento), s: "Soma Preço Total", c: ACENTO.padrao },
    { l: "Emissões", v: fmtNum(r.emissoes), s: "Apenas op. Emissão", c: ACENTO.azul },
    { l: "Milhas Vendidas", v: fmtMilhas(r.milhas), s: "Cobradas", c: ACENTO.dourado },
    { l: "PAX", v: fmtNum(r.pax), s: "Apenas op. Emissão", c: ACENTO.verde },
    { l: "Ticket Médio", v: fmtBRL(r.ticket), s: "Faturamento ÷ emissões", c: ACENTO.ambar },
    { l: "Recebido (PAGO)", v: fmtBRL(r.pago), s: doTotal(r.pago), c: ACENTO.verde },
    { l: "A Receber", v: fmtBRL(r.aberto), s: doTotal(r.aberto), c: ACENTO.ambar },
    { l: "Cancelado", v: fmtBRL(r.cancelado), s: doTotal(r.cancelado), c: ACENTO.vermelho },
    { l: "Preço Médio Milheiro", v: fmtBRL2(r.milheiroMedio), s: "Média ponderada", c: ACENTO.padrao },
    { l: "Taxas Cobradas", v: fmtBRL(r.taxas), s: "Total de taxas", c: ACENTO.azul },
    { l: "Venda de Milhas", v: fmtBRL(r.vendaMilhas), s: doFat(r.vendaMilhas), c: ACENTO.dourado },
    { l: "Taxas + Outros", v: fmtBRL(r.taxasOutros), s: doFat(r.taxasOutros), c: ACENTO.azul },
    { l: "Faturamento ÷ PAX", v: fmtBRL(r.fatPorPax), s: "Receita média por passageiro", c: ACENTO.verde },
    { l: "Milhas ÷ PAX", v: fmtNum(Math.round(r.milhasPorPax)), s: "Milhas médias por PAX", c: ACENTO.ambar },
    { l: "Milhas ÷ Emissão", v: fmtNum(Math.round(r.milhasPorEmissao)), s: "Tamanho médio do pacote", c: ACENTO.padrao },
  ];

  const opts = (campo: keyof RegistroDash) => valoresDe(base, campo);
  const anoLabel = meses.length ? `Total ${meses[0].slice(0, 4)}` : "Total";

  if (isLoading) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <Loader2 className="inline h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Dashboard de Faturamento</h1>
          <AjudaButton chave="dashboard_faturamento" />
        </div>
        <Button variant="outline" onClick={exportar} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" />Exportar Excel
        </Button>
      </div>

      {/* ------------------------------------------------------- filtros */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Select value={fOrigem} onValueChange={setFOrigem}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="propria">Emissões próprias</SelectItem>
              <SelectItem value="terceirizada">Terceirizadas</SelectItem>
              <SelectItem value={ALL}>Próprias + terceirizadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fPrograma} onValueChange={setFPrograma}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Programa" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos programas</SelectItem>{opts("programa").map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fEmissor} onValueChange={setFEmissor}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Emissor" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos emissores</SelectItem>{opts("emissor").map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fCliente} onValueChange={setFCliente}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos clientes</SelectItem>{opts("cliente").map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status Pix" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos status</SelectItem>{opts("status").map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">De</label>
            <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Até</label>
            <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="w-40" />
          </div>
          {temFiltro && <Button variant="ghost" size="sm" onClick={limpar}><X className="mr-1 h-4 w-4" />Limpar</Button>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["", ...mesesDisponiveis].map((m) => (
            <button
              key={m || "todos"}
              onClick={() => selecionarMes(m)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                mesSelecionado === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {m ? mesLabel(m) : "Todos os meses"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {fmtNum(rows.length)} registros · {fmtNum(r.emissoes)} emissões
          {limites && ` · ${fmtDataBR(limites[0])} a ${fmtDataBR(limites[1])}`}
        </p>
      </Card>

      {/* --------------------------------------------------- KPIs gerais */}
      <section>
        <h2 className="mb-2 text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">Indicadores do período</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((k) => (
            <Card key={k.l} className="rounded-l-none border-l-4 p-3" style={{ borderLeftColor: k.c }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k.l}</p>
              <p className="mt-1 truncate text-xl font-display font-bold" title={k.v}>{k.v}</p>
              {k.s && <p className="text-[11px] text-muted-foreground">{k.s}</p>}
            </Card>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- KPIs mensais */}
      <section>
        <h2 className="mb-2 text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">Faturamento mensal</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpisMes.map((m) => (
            <Card key={m.mes} className="rounded-l-none border-l-4 p-3" style={{ borderLeftColor: acentoDoMes(m.mes) }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{mesLabel(m.mes)}</p>
              <p className="mt-1 text-xl font-display font-bold">{fmtBRL(m.faturamento)}</p>
              <p className="text-sm font-medium">{Math.round(m.milhas / 1e6)}M milhas</p>
              <p className="text-[11px] text-muted-foreground">{fmtNum(m.emissoes)} emissões · ticket {fmtBRL(m.ticket)}</p>
            </Card>
          ))}
          <Card className="rounded-l-none border-l-4 p-3" style={{ background: "linear-gradient(135deg,#0A0A0A,#1F1F1F)", borderLeftColor: "#D4AF37" }}>
            <p className="text-xs" style={{ color: "#D4AF37" }}>{anoLabel}</p>
            <p className="mt-1 text-xl font-display font-bold text-white">{fmtBRL(r.faturamento)}</p>
            <p className="text-sm font-medium text-gray-200">{Math.round(r.milhas / 1e6)}M milhas</p>
            <p className="text-[11px] text-gray-400">{fmtNum(r.emissoes)} emissões · ticket {fmtBRL(r.ticket)}</p>
          </Card>
        </div>
      </section>

      {/* -------------------------------------------- programa por mês */}
      <section className="space-y-3">
        <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">Programa por mês</h2>
        <div className="grid gap-3 xl:grid-cols-2">
          <CardTabela titulo="Faturamento (R$)">
            <TabelaProgramaMes matriz={mFat} fmt={fmtBRL} cor={corPrograma} />
          </CardTabela>
          <CardTabela titulo="Venda de Milhas (R$, sem taxas e outros)">
            <TabelaProgramaMes matriz={mVenda} fmt={fmtBRL} cor={corPrograma} />
          </CardTabela>
          <CardTabela titulo="Milhas vendidas">
            <TabelaProgramaMes matriz={mMilhas} fmt={fmtMilK} cor={corPrograma} />
          </CardTabela>
          <CardTabela titulo="Emissões (qtd)" nota="Conta apenas operações do tipo Emissão.">
            <TabelaProgramaMes matriz={mEmi} fmt={fmtNum} cor={corPrograma} />
          </CardTabela>
        </div>
        <CardTabela titulo="Milhas ÷ PAX" nota="Apenas operações do tipo Emissão.">
          <TabelaProgramaMes matriz={mMilPax} fmt={fmtMilK} cor={corPrograma} mostrarPct={false} />
        </CardTabela>
      </section>

      {/* ------------------------------------------ faixas de precificação */}
      <section className="space-y-3">
        <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">Faixas de precificação</h2>
        <div className="grid gap-3 xl:grid-cols-2">
          {FAIXAS.map((f) => (
            <CardTabela key={f.programa} titulo={`${f.programa} — visão geral por faixa`} corTopo={f.cor}>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b">
                    {["Faixa", "Emi", "% Emi", "PAX", "Milhas", "Faturamento", "% Fat", "Milheiro"].map((c, i) => (
                      <th key={c} className={`px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${i === 0 ? "text-left" : "text-center"}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const linhas = faixaResumo(rows, f);
                    const tEmi = linhas.reduce((s, l) => s + l.emissoes, 0);
                    const tFat = linhas.reduce((s, l) => s + l.faturamento, 0);
                    const tPax = linhas.reduce((s, l) => s + l.pax, 0);
                    const tMi = linhas.reduce((s, l) => s + l.milhas, 0);
                    if (!linhas.length) {
                      return <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Sem dados no filtro.</td></tr>;
                    }
                    return (
                      <>
                        {linhas.map((l) => (
                          <tr key={l.faixa} className="border-b">
                            <td className="px-2 py-1.5 font-medium">{l.faixa}</td>
                            <td className="px-2 py-1.5 text-center font-semibold tabular-nums">{fmtNum(l.emissoes)}</td>
                            <td className="px-2 py-1.5 text-center tabular-nums">{fmtPct1(tEmi ? (l.emissoes / tEmi) * 100 : 0)}</td>
                            <td className="px-2 py-1.5 text-center tabular-nums">{fmtNum(l.pax)}</td>
                            <td className="px-2 py-1.5 text-center tabular-nums">{fmtMilK(l.milhas)}</td>
                            <td className="px-2 py-1.5 text-center font-semibold tabular-nums">{fmtBRL(l.faturamento)}</td>
                            <td className="px-2 py-1.5 text-center tabular-nums">{fmtPct1(tFat ? (l.faturamento / tFat) * 100 : 0)}</td>
                            <td className="px-2 py-1.5 text-center tabular-nums">{fmtBRL2(l.milheiro)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-semibold">
                          <td className="px-2 py-1.5">TOTAL</td>
                          <td className="px-2 py-1.5 text-center tabular-nums">{fmtNum(tEmi)}</td>
                          <td className="px-2 py-1.5 text-center">100,0%</td>
                          <td className="px-2 py-1.5 text-center tabular-nums">{fmtNum(tPax)}</td>
                          <td className="px-2 py-1.5 text-center tabular-nums">{fmtMilK(tMi)}</td>
                          <td className="px-2 py-1.5 text-center tabular-nums">{fmtBRL(tFat)}</td>
                          <td className="px-2 py-1.5 text-center">100,0%</td>
                          <td className="px-2 py-1.5 text-center">—</td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </CardTabela>
          ))}

          {FAIXAS.map((f) => (
            <CardTabela key={`${f.programa}-emi`} titulo={`${f.programa} — emissões por faixa por mês`} corTopo={f.cor}>
              <TabelaFaixaMes matriz={faixaPorMes(rows, f, meses, "emissoes")} rgb={f.rgb} fmt={fmtNum} mostrarPct />
            </CardTabela>
          ))}

          {FAIXAS.map((f) => (
            <CardTabela
              key={`${f.programa}-fat`}
              titulo={`${f.programa} — faturamento por faixa por mês`}
              corTopo={f.cor}
              nota="Considera apenas operações tipo Emissão com PAX > 0. Pós-vendas ficam de fora, então o total pode diferir da tabela de Faturamento por programa."
            >
              <TabelaFaixaMes matriz={faixaPorMes(rows, f, meses, "faturamento")} rgb={f.rgb} fmt={fmtBRL} mostrarPct />
            </CardTabela>
          ))}

          {FAIXAS.map((f) => (
            <CardTabela key={`${f.programa}-prc`} titulo={`${f.programa} — preço médio do milheiro por faixa`} corTopo={f.cor} nota="Média ponderada por milhas.">
              <TabelaFaixaMes matriz={faixaPorMes(rows, f, meses, "milheiro")} rgb={f.rgb} fmt={fmtBRL2} rotuloTotal="Média Período" ponderado />
            </CardTabela>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- gráficos */}
      <section className="space-y-3">
        <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">Gráficos</h2>
        <CardTabela titulo="Milhas vendidas por programa por mês">
          <ColunasEmpilhadas labels={meses.map(mesLabel)} series={serieProgMilhas} fmt={fmtMilhas} tituloEixo="Milhas vendidas" />
        </CardTabela>
        <CardTabela titulo="Faturamento por programa">
          <BarrasHorizontais
            labels={progFat.map((p) => p.chave)}
            series={[{ label: "Faturamento", cor: "#1F4E78", valores: progFat.map((p) => p.total) }]}
            fmt={fmtBRL}
          />
        </CardTabela>
        <CardTabela titulo="Emissões por emissor por mês" nota="Emissores que só fazem pós-venda aparecem com zero — é o esperado.">
          <BarrasHorizontais labels={emissores.map((e) => e.chave)} series={serieEmissorMes} fmt={fmtNum} tituloEixo="Quantidade de emissões" />
        </CardTabela>
        <CardTabela titulo="Top 15 clientes por faturamento">
          <BarrasHorizontais labels={nomesTop15} series={serieTop15Prog} fmt={fmtBRL} />
        </CardTabela>
        <CardTabela titulo="Faturamento mensal — top 15 clientes">
          <ColunasEmpilhadas labels={meses.map(mesLabel)} series={serieTop15Mes} fmt={fmtBRL} tituloEixo="Faturamento (R$)" />
        </CardTabela>
        <CardTabela titulo="Faturamento semanal" nota="Semanas ISO, de segunda a domingo. Role para o lado para ver todo o período.">
          <LinhaArea
            labels={semanas.map((s) => s.label)}
            valores={semanas.map((s) => s.total)}
            fmt={fmtBRL}
            larguraPonto={52}
            tooltips={semanas.map((s) => `${s.label}: ${fmtBRL2(s.total)} · ${s.emissoes} emissões`)}
          />
        </CardTabela>
        <div className="grid gap-3 xl:grid-cols-2">
          <CardTabela titulo="Faturamento por dia da semana">
            <Colunas labels={DOW_LABELS.map((d) => d.slice(0, 3))} valores={dow.fat} cores={CORES_MES} fmt={fmtBRL} />
          </CardTabela>
          <CardTabela titulo="Emissões por dia da semana">
            <Colunas labels={DOW_LABELS.map((d) => d.slice(0, 3))} valores={dow.emi} cores={CORES_MES} fmt={fmtNum} />
          </CardTabela>
        </div>
        <CardTabela titulo="Vendas diárias" nota="Um ponto por dia. Role para o lado para ver todo o período.">
          <LinhaArea
            labels={dias.map((d) => fmtDataBR(d.data))}
            valores={dias.map((d) => d.total)}
            fmt={fmtBRL}
            larguraPonto={30}
            tooltips={dias.map((d) => `${fmtDataBR(d.data)}: ${fmtBRL2(d.total)} · ${d.emissoes} emissões`)}
          />
        </CardTabela>
      </section>

      {/* ------------------------------------------------ rankings mensais */}
      <section className="space-y-3">
        <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">
          Top 15 clientes por mês — faturamento
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rankingPorMes.map((m) => (
            <div key={m.mes} className="overflow-hidden rounded-lg border bg-card">
              <div className="px-3 py-2 text-center text-sm font-semibold text-white" style={{ background: "#1F4E78" }}>
                {mesLabel(m.mes)}
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {m.porFaturamento.map((c, i) => (
                    <tr key={c.cliente} className="border-b last:border-0">
                      <td className="w-6 px-2 py-1 text-right text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1 font-medium">{c.cliente}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(c.faturamento)}</td>
                      <td className="px-2 py-1 text-right text-[11px] text-muted-foreground tabular-nums">{c.emissoes}</td>
                      <td className="px-2 py-1 text-right text-[11px] text-muted-foreground">
                        {fmtPct1(m.totalMes ? (c.faturamento / m.totalMes) * 100 : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between border-t px-3 py-1.5 text-[11px]">
                <span>Top 15: {fmtBRL(m.porFaturamento.reduce((s, c) => s + c.faturamento, 0))}</span>
                <span className="font-semibold">
                  {fmtPct1(m.totalMes ? (m.porFaturamento.reduce((s, c) => s + c.faturamento, 0) / m.totalMes) * 100 : 0)} do mês
                </span>
              </div>
            </div>
          ))}
        </div>

        <h2 className="pt-2 text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">
          Top 15 clientes por mês — emissões
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rankingPorMes.map((m) => (
            <div key={m.mes} className="overflow-hidden rounded-lg border bg-card">
              <div className="px-3 py-2 text-center text-sm font-semibold text-white" style={{ background: "#10B981" }}>
                {mesLabel(m.mes)}
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {m.porEmissoes.map((c, i) => (
                    <tr key={c.cliente} className="border-b last:border-0">
                      <td className="w-6 px-2 py-1 text-right text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1 font-medium">{c.cliente}</td>
                      <td className="px-2 py-1 text-right font-semibold tabular-nums">{c.emissoes}</td>
                      <td className="px-2 py-1 text-right text-[11px] text-muted-foreground tabular-nums">{fmtBRL(c.faturamento)}</td>
                      <td className="px-2 py-1 text-right text-[11px] text-muted-foreground">
                        {fmtPct1(m.emiMes ? (c.emissoes / m.emiMes) * 100 : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between border-t px-3 py-1.5 text-[11px]">
                <span>Top 15: {m.porEmissoes.reduce((s, c) => s + c.emissoes, 0)} emi</span>
                <span className="font-semibold">
                  {fmtPct1(m.emiMes ? (m.porEmissoes.reduce((s, c) => s + c.emissoes, 0) / m.emiMes) * 100 : 0)} do mês
                </span>
              </div>
            </div>
          ))}
        </div>

        <CardTabela titulo="% do faturamento mensal — top 15 clientes" nota="Participação do cliente no faturamento daquele mês.">
          <MatrizPctClientes clientes={nomesTop15} meses={meses} pcts={pctTop15.pcts} totais={pctTop15.totais} />
        </CardTabela>
      </section>

      {/* ------------------------------------------------------ calendários */}
      <section className="space-y-3">
        <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">Calendários</h2>
        <CardTabela titulo="Faturamento diário — semana × dia da semana">
          <CalendarioDash cal={calGeral} rgb={RGB_VERDE} fmt={fmtBRL} />
        </CardTabela>
        <div className="grid gap-3 xl:grid-cols-2">
          <CardTabela titulo="Smiles — milhas por dia" corTopo={PROG_CORES.Smiles}>
            <CalendarioDash cal={calSmiles} rgb={RGB_SMILES} fmt={fmtMilK} />
          </CardTabela>
          <CardTabela titulo="Latam — milhas por dia" corTopo={PROG_CORES.Latam}>
            <CalendarioDash cal={calLatam} rgb={RGB_LATAM} fmt={fmtMilK} />
          </CardTabela>
        </div>
      </section>

      {/* ----------------------------------------------------- detalhamento */}
      <section className="space-y-2">
        <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">Detalhamento</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b">
                <th className={THDET}>Emissão</th>
                <th className={THDET}>
                  <button
                    type="button"
                    onClick={() => detalheOrdenado.toggle("data")}
                    className={`inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground ${
                      detalheOrdenado.key === "data" ? "font-semibold text-foreground" : ""
                    }`}
                  >
                    Data
                    {detalheOrdenado.key === "data" ? (
                      detalheOrdenado.dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </button>
                </th>
                {["Programa", "Operação", "Emissor", "Cliente", "PAX", "Milhas", "Preço/Mil", "Taxas", "Outros", "Total", "Status"].map((c) => (
                  <th key={c} className={THDET}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagina.paged.map((x, i) => (
                <tr key={`${x.id_emissao}-${i}`} className="border-b last:border-0">
                  <td className="px-2 py-1.5 font-mono text-[11px]">{x.id_emissao}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataBR(x.data)}</td>
                  <td className="px-2 py-1.5">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: corPrograma(x.programa) }} />
                    {x.programa}
                  </td>
                  <td className="px-2 py-1.5">{x.operacao}</td>
                  <td className="px-2 py-1.5">{x.emissor}</td>
                  <td className="px-2 py-1.5">{x.cliente}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{x.pax || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(x.milhas)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtBRL2(x.preco_milheiro)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtBRL2(x.taxas)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtBRL2(x.outros)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtBRL2(x.total)}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={
                        x.status === "PAGO" ? { background: "#D1FAE5", color: "#065F46" }
                        : x.status === "EM ABERTO" ? { background: "#FEF3C7", color: "#92400E" }
                        : { background: "#FEE2E2", color: "#991B1B" }
                      }
                    >
                      {x.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!detalhe.length && (
                <tr><td colSpan={13} className="py-8 text-center text-muted-foreground">Nenhum registro no filtro.</td></tr>
              )}
            </tbody>
          </table>
          </div>
          <PaginationBar
            page={pagina.page}
            totalPages={pagina.totalPages}
            from={pagina.from}
            to={pagina.to}
            total={pagina.total}
            onPage={pagina.setPage}
          />
        </Card>
      </section>
    </div>
  );
}
