import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/hooks/usePerfil";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { Plane, Coins, Gauge, Receipt, Search, Download, Loader2, X } from "lucide-react";
import { format } from "date-fns";

interface Row {
  id: string;
  serie: string;
  owner_id: string;
  operador: string;
  data_emissao: string | null;
  programa: string;
  nome_operacao: string;
  status_pix: string;
  emissor: string;
  cartao: string;
  cliente: string;
  conta: string;
  facial: boolean;
  passageiros_qtd: number;
  milhas_cobrado: number;
  preco_milheiro: number;
  milhas_real: number;
  taxas_cobrado: number;
  taxas_real: number;
  outros_cobrado: number;
  outros_real: number;
  bagagens_cobrado: number;
  assentos_cobrado: number;
  preco_total: number;
  valor_recebido: number;
}

const ALL = "__all";
const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number) => (v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const sum = (arr: Row[], k: keyof Row) => arr.reduce((a, r) => a + (Number(r[k]) || 0), 0);
const avgMilheiro = (arr: Row[]) => {
  const f = arr.filter((r) => (Number(r.preco_milheiro) || 0) > 0);
  return f.length ? f.reduce((a, r) => a + (Number(r.preco_milheiro) || 0), 0) / f.length : 0;
};

export default function RelatorioEmissoesPage() {
  const [fSerie, setFSerie] = useState(ALL);
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fProg, setFProg] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fOp, setFOp] = useState(ALL);
  const [fEm, setFEm] = useState(ALL);
  const [fCa, setFCa] = useState(ALL);
  const [busca, setBusca] = useState("");

  const { user } = useAuth();
  const { data: perfil } = usePerfil();
  // admin e super_admin enxergam tudo; operador vê apenas as próprias emissões
  const veTudo = perfil?.papel === "super_admin" || perfil?.papel === "admin";

  const { data: rawRows, isLoading } = useQuery({
    queryKey: ["relatorio-emissoes", user?.id, perfil?.papel],
    enabled: !!perfil,
    queryFn: async (): Promise<Row[]> => {
      const sel = "id_emissao, owner_id, data_emissao, programa, nome_operacao, status_pix, emissor, forma_pagamento, facial, passageiros_qtd, milhas_cobrado, preco_milheiro, milhas_real, taxas_cobrado, taxas_real, outros_cobrado, outros_real, bagagens_cobrado, assentos_cobrado, preco_total, valor_recebido, clientes(codigo), contas(codigo)";
      // PostgREST corta em 1000 linhas por requisição — paginar para trazer todas.
      const PAGE = 1000;
      const data: any[] = [];
      for (let ini = 0; ; ini += PAGE) {
        let q = supabase.from("emissoes").select(sel).order("id_emissao", { ascending: true }).range(ini, ini + PAGE - 1);
        if (!veTudo && user) q = q.eq("owner_id", user.id);
        const { data: pg, error } = await q;
        if (error) throw error;
        data.push(...(pg ?? []));
        if (!pg || pg.length < PAGE) break;
      }
      return data.map((r: any) => ({
        id: r.id_emissao ?? "",
        serie: (String(r.id_emissao ?? "").match(/^[A-Za-z]+/)?.[0] ?? "—"),
        owner_id: r.owner_id ?? "",
        operador: "",
        data_emissao: r.data_emissao,
        programa: r.programa ?? "",
        nome_operacao: r.nome_operacao ?? "",
        status_pix: r.status_pix ?? "",
        emissor: r.emissor ?? "",
        cartao: r.forma_pagamento ?? "",
        cliente: (r.clientes as any)?.codigo ?? "",
        conta: (r.contas as any)?.codigo ?? "",
        facial: !!r.facial,
        passageiros_qtd: r.passageiros_qtd ?? 0,
        milhas_cobrado: r.milhas_cobrado ?? 0,
        preco_milheiro: r.preco_milheiro ?? 0,
        milhas_real: r.milhas_real ?? 0,
        taxas_cobrado: r.taxas_cobrado ?? 0,
        taxas_real: r.taxas_real ?? 0,
        outros_cobrado: r.outros_cobrado ?? 0,
        outros_real: r.outros_real ?? 0,
        bagagens_cobrado: r.bagagens_cobrado ?? 0,
        assentos_cobrado: r.assentos_cobrado ?? 0,
        preco_total: r.preco_total ?? 0,
        valor_recebido: r.valor_recebido ?? 0,
      }));
    },
  });

  // Nomes dos usuários (para a tabela "Por operador" = dono da emissão)
  const { data: perfisUsuarios } = useQuery({
    queryKey: ["perfis-nomes"],
    queryFn: async () => {
      const { data } = await supabase.from("perfis_usuario").select("id, nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const perfisMap = useMemo(() => {
    const m = new Map<string, string>();
    (perfisUsuarios ?? []).forEach((p) => m.set(p.id, p.nome));
    return m;
  }, [perfisUsuarios]);
  const rows = useMemo(
    () => (rawRows ?? []).map((r) => ({ ...r, operador: perfisMap.get(r.owner_id) || "—" })),
    [rawRows, perfisMap]
  );

  const opts = (k: keyof Row) =>
    Array.from(new Set((rows ?? []).map((r) => r[k] as string))).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));

  const filtered = useMemo(() => {
    let list = [...(rows ?? [])];
    if (fSerie !== ALL) list = list.filter((r) => r.serie === fSerie);
    if (fDe) list = list.filter((r) => r.data_emissao && r.data_emissao >= fDe);
    if (fAte) list = list.filter((r) => r.data_emissao && r.data_emissao <= fAte);
    if (fProg !== ALL) list = list.filter((r) => r.programa === fProg);
    if (fStatus !== ALL) list = list.filter((r) => r.status_pix === fStatus);
    if (fOp !== ALL) list = list.filter((r) => r.nome_operacao === fOp);
    if (fEm !== ALL) list = list.filter((r) => r.emissor === fEm);
    if (fCa !== ALL) list = list.filter((r) => r.cartao === fCa);
    if (busca.trim()) {
      const s = busca.toLowerCase();
      list = list.filter((r) => [r.id, r.conta, r.cliente, r.emissor, r.cartao].some((c) => String(c ?? "").toLowerCase().includes(s)));
    }
    return list;
  }, [rows, fSerie, fDe, fAte, fProg, fStatus, fOp, fEm, fCa, busca]);

  const temFiltro = fSerie !== ALL || fDe || fAte || fProg !== ALL || fStatus !== ALL || fOp !== ALL || fEm !== ALL || fCa !== ALL || busca.trim();
  const limpar = () => { setFSerie(ALL); setFDe(""); setFAte(""); setFProg(ALL); setFStatus(ALL); setFOp(ALL); setFEm(ALL); setFCa(ALL); setBusca(""); };

  // Linhas agregadas (com campos nomeados) para as tabelas ordenáveis
  const grupo = (key: keyof Row) =>
    agrupar(key).map(([k, a]) => ({ nome: k, emissoes: a.length, milhas: sum(a, "milhas_cobrado"), milheiro: avgMilheiro(a), taxas: sum(a, "taxas_cobrado"), preco: sum(a, "preco_total") }));
  const gPrograma = useMemo(() => grupo("programa"), [filtered]);
  const gSerie = useMemo(() => grupo("serie"), [filtered]);
  const gCartao = useMemo(() => grupo("cartao"), [filtered]);
  const gCliente = useMemo(() => grupo("cliente"), [filtered]);
  const gOperador = useMemo(() => grupo("operador"), [filtered]);
  const gEmissor = useMemo(() => grupo("emissor"), [filtered]);
  const spg = useSort<any>(gPrograma);
  const sse = useSort<any>(gSerie);
  const sca = useSort<any>(gCartao);
  const scl = useSort<any>(gCliente);
  const sop = useSort<any>(gOperador);
  const sem = useSort<any>(gEmissor);
  const sdet = useSort<Row>(filtered);

  const pagas = filtered.filter((r) => r.status_pix === "PAGO").length;
  const abertas = filtered.filter((r) => r.status_pix === "EM ABERTO");
  const canceladas = filtered.filter((r) => r.status_pix === "CANCELADO").length;

  const somatorios = [
    { l: "Emissões", v: num(filtered.length) },
    { l: "Pagas / Aberto / Cancel.", v: `${pagas} / ${abertas.length} / ${canceladas}` },
    { l: "Preço Milheiro (média)", v: brl(avgMilheiro(filtered)) },
    { l: "Milhas cobradas", v: num(sum(filtered, "milhas_cobrado")) },
    { l: "Milhas reais", v: num(sum(filtered, "milhas_real")) },
    { l: "Taxas cobradas", v: brl(sum(filtered, "taxas_cobrado")) },
    { l: "Taxas reais", v: brl(sum(filtered, "taxas_real")) },
    { l: "Outros cobrado", v: brl(sum(filtered, "outros_cobrado")) },
    { l: "Outros real", v: brl(sum(filtered, "outros_real")) },
    { l: "Bagagens cobrado", v: brl(sum(filtered, "bagagens_cobrado")) },
    { l: "Assentos cobrado", v: brl(sum(filtered, "assentos_cobrado")) },
    { l: "Preço total", v: brl(sum(filtered, "preco_total")) },
    { l: "Valor recebido (todas)", v: brl(sum(filtered, "valor_recebido")) },
    { l: "Passageiros (Nº Pax)", v: num(sum(filtered, "passageiros_qtd")) },
    { l: "Facial ativo", v: num(filtered.filter((r) => r.facial).length) },
  ];

  function agrupar(key: keyof Row) {
    const m = new Map<string, Row[]>();
    filtered.forEach((r) => {
      const k = (r[key] as string) || "(vazio)";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }

  const exportarCSV = () => {
    const head = ["ID", "Data", "Programa", "Operacao", "Status", "Emissor", "Conta", "Cliente", "Cartao", "Pax", "MilhasCobrado", "MilhasReal", "TaxasCobrado", "TaxasReal", "OutrosCobrado", "OutrosReal", "BagagensCobrado", "AssentosCobrado", "PrecoTotal", "ValorRecebido"];
    const linhas = filtered.map((r) => [r.id, r.data_emissao ?? "", r.programa, r.nome_operacao, r.status_pix, r.emissor, r.conta, r.cliente, r.cartao, r.passageiros_qtd, r.milhas_cobrado, r.milhas_real, r.taxas_cobrado, r.taxas_real, r.outros_cobrado, r.outros_real, r.bagagens_cobrado, r.assentos_cobrado, r.preco_total, r.valor_recebido]);
    const csv = [head, ...linhas].map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-emissoes-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (s: string) => {
    if (s === "PAGO") return <span className="inline-block rounded-full bg-success/15 text-success px-2 py-0.5 text-xs font-semibold">PAGO</span>;
    if (s === "EM ABERTO") return <span className="inline-block rounded-full bg-warning/15 text-warning px-2 py-0.5 text-xs font-semibold">EM ABERTO</span>;
    return <span className="inline-block rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-xs font-semibold">CANCELADO</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Relatório de Emissões</h1>
        <Button variant="outline" onClick={exportarCSV} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Select value={fSerie} onValueChange={setFSerie}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Série (ID)" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todas as séries</SelectItem>{opts("serie").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Data de</label>
            <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Data até</label>
            <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="w-40" />
          </div>
          <Select value={fProg} onValueChange={setFProg}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Programa" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos programas</SelectItem>{opts("programa").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos status</SelectItem>{opts("status_pix").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fOp} onValueChange={setFOp}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Operação" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todas operações</SelectItem>{opts("nome_operacao").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fEm} onValueChange={setFEm}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Emissor" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos emissores</SelectItem>{opts("emissor").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fCa} onValueChange={setFCa}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Cartão" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos cartões</SelectItem>{opts("cartao").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ID, conta, cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 w-52" />
          </div>
          {temFiltro && (
            <Button variant="ghost" size="sm" onClick={limpar}><X className="h-4 w-4 mr-1" />Limpar</Button>
          )}
        </div>
      </Card>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
      ) : (
        <>
          {/* Somatórios de todos os campos */}
          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Somatórios dos campos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {somatorios.map((s) => (
                <Card key={s.l} className="p-3">
                  <p className="text-xs text-muted-foreground">{s.l}</p>
                  <p className="text-lg font-display font-bold text-foreground mt-1 truncate" title={s.v}>{s.v}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Por programa */}
          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por programa</h2>
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Programa" sortKey="nome" activeKey={spg.key} dir={spg.dir} onSort={spg.toggle} />
                    <SortableHead label="Emissões" sortKey="emissoes" activeKey={spg.key} dir={spg.dir} onSort={spg.toggle} align="right" className="text-right" />
                    <SortableHead label="Qtde Milhas (Cob.)" sortKey="milhas" activeKey={spg.key} dir={spg.dir} onSort={spg.toggle} align="right" className="text-right" />
                    <SortableHead label="Preço Milheiro (méd.)" sortKey="milheiro" activeKey={spg.key} dir={spg.dir} onSort={spg.toggle} align="right" className="text-right" />
                    <SortableHead label="Preço total" sortKey="preco" activeKey={spg.key} dir={spg.dir} onSort={spg.toggle} align="right" className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spg.sorted.map((r) => (
                    <TableRow key={r.nome}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-right font-mono">{num(r.emissoes)}</TableCell>
                      <TableCell className="text-right font-mono">{num(r.milhas)}</TableCell>
                      <TableCell className="text-right font-mono">{brl(r.milheiro)}</TableCell>
                      <TableCell className="text-right font-mono">{brl(r.preco)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right font-mono">{num(filtered.length)}</TableCell>
                    <TableCell className="text-right font-mono">{num(sum(filtered, "milhas_cobrado"))}</TableCell>
                    <TableCell className="text-right font-mono">{brl(avgMilheiro(filtered))}</TableCell>
                    <TableCell className="text-right font-mono">{brl(sum(filtered, "preco_total"))}</TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </Card>
          </div>

          {/* Por série (ID) */}
          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por série (ID)</h2>
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Série" sortKey="nome" activeKey={sse.key} dir={sse.dir} onSort={sse.toggle} />
                    <SortableHead label="Emissões" sortKey="emissoes" activeKey={sse.key} dir={sse.dir} onSort={sse.toggle} align="right" className="text-right" />
                    <SortableHead label="Qtde Milhas (Cob.)" sortKey="milhas" activeKey={sse.key} dir={sse.dir} onSort={sse.toggle} align="right" className="text-right" />
                    <SortableHead label="Preço Milheiro (méd.)" sortKey="milheiro" activeKey={sse.key} dir={sse.dir} onSort={sse.toggle} align="right" className="text-right" />
                    <SortableHead label="Preço total" sortKey="preco" activeKey={sse.key} dir={sse.dir} onSort={sse.toggle} align="right" className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sse.sorted.map((r) => (
                    <TableRow key={r.nome}>
                      <TableCell className="font-mono font-medium">{r.nome}</TableCell>
                      <TableCell className="text-right font-mono">{num(r.emissoes)}</TableCell>
                      <TableCell className="text-right font-mono">{num(r.milhas)}</TableCell>
                      <TableCell className="text-right font-mono">{brl(r.milheiro)}</TableCell>
                      <TableCell className="text-right font-mono">{brl(r.preco)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Por cartão */}
          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por cartão utilizado</h2>
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Cartão" sortKey="nome" activeKey={sca.key} dir={sca.dir} onSort={sca.toggle} />
                    <SortableHead label="Emissões" sortKey="emissoes" activeKey={sca.key} dir={sca.dir} onSort={sca.toggle} align="right" className="text-right" />
                    <SortableHead label="Qtde Milhas (Cob.)" sortKey="milhas" activeKey={sca.key} dir={sca.dir} onSort={sca.toggle} align="right" className="text-right" />
                    <SortableHead label="Preço Milheiro (méd.)" sortKey="milheiro" activeKey={sca.key} dir={sca.dir} onSort={sca.toggle} align="right" className="text-right" />
                    <SortableHead label="Preço total" sortKey="preco" activeKey={sca.key} dir={sca.dir} onSort={sca.toggle} align="right" className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sca.sorted.map((r) => (
                    <TableRow key={r.nome}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-right font-mono">{num(r.emissoes)}</TableCell>
                      <TableCell className="text-right font-mono">{num(r.milhas)}</TableCell>
                      <TableCell className="text-right font-mono">{brl(r.milheiro)}</TableCell>
                      <TableCell className="text-right font-mono">{brl(r.preco)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Por cliente */}
          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por cliente</h2>
            <Card className="overflow-hidden">
              <div className="max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <SortableHead label="Cliente" sortKey="nome" activeKey={scl.key} dir={scl.dir} onSort={scl.toggle} />
                      <SortableHead label="Emissões" sortKey="emissoes" activeKey={scl.key} dir={scl.dir} onSort={scl.toggle} align="right" className="text-right" />
                      <SortableHead label="Qtde Milhas (Cob.)" sortKey="milhas" activeKey={scl.key} dir={scl.dir} onSort={scl.toggle} align="right" className="text-right" />
                      <SortableHead label="Preço Milheiro (méd.)" sortKey="milheiro" activeKey={scl.key} dir={scl.dir} onSort={scl.toggle} align="right" className="text-right" />
                      <SortableHead label="Preço total" sortKey="preco" activeKey={scl.key} dir={scl.dir} onSort={scl.toggle} align="right" className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scl.sorted.map((r) => (
                      <TableRow key={r.nome}>
                        <TableCell className="font-mono font-medium">{r.nome}</TableCell>
                        <TableCell className="text-right font-mono">{num(r.emissoes)}</TableCell>
                        <TableCell className="text-right font-mono">{num(r.milhas)}</TableCell>
                        <TableCell className="text-right font-mono">{brl(r.milheiro)}</TableCell>
                        <TableCell className="text-right font-mono">{brl(r.preco)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* Por operador (dono) */}
          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por operador</h2>
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Operador" sortKey="nome" activeKey={sop.key} dir={sop.dir} onSort={sop.toggle} />
                    <SortableHead label="Emissões" sortKey="emissoes" activeKey={sop.key} dir={sop.dir} onSort={sop.toggle} align="right" className="text-right" />
                    <SortableHead label="Qtde Milhas (Cob.)" sortKey="milhas" activeKey={sop.key} dir={sop.dir} onSort={sop.toggle} align="right" className="text-right" />
                    <SortableHead label="Preço Milheiro (méd.)" sortKey="milheiro" activeKey={sop.key} dir={sop.dir} onSort={sop.toggle} align="right" className="text-right" />
                    <SortableHead label="Preço total" sortKey="preco" activeKey={sop.key} dir={sop.dir} onSort={sop.toggle} align="right" className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sop.sorted.map((r) => (
                    <TableRow key={r.nome}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-right font-mono">{num(r.emissoes)}</TableCell>
                      <TableCell className="text-right font-mono">{num(r.milhas)}</TableCell>
                      <TableCell className="text-right font-mono">{brl(r.milheiro)}</TableCell>
                      <TableCell className="text-right font-mono">{brl(r.preco)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Por emissor */}
          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por emissor</h2>
            <Card className="overflow-hidden">
              <div className="max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <SortableHead label="Emissor" sortKey="nome" activeKey={sem.key} dir={sem.dir} onSort={sem.toggle} />
                      <SortableHead label="Emissões" sortKey="emissoes" activeKey={sem.key} dir={sem.dir} onSort={sem.toggle} align="right" className="text-right" />
                      <SortableHead label="Qtde Milhas (Cob.)" sortKey="milhas" activeKey={sem.key} dir={sem.dir} onSort={sem.toggle} align="right" className="text-right" />
                      <SortableHead label="Preço Milheiro (méd.)" sortKey="milheiro" activeKey={sem.key} dir={sem.dir} onSort={sem.toggle} align="right" className="text-right" />
                      <SortableHead label="Preço total" sortKey="preco" activeKey={sem.key} dir={sem.dir} onSort={sem.toggle} align="right" className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sem.sorted.map((r) => (
                      <TableRow key={r.nome}>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell className="text-right font-mono">{num(r.emissoes)}</TableCell>
                        <TableCell className="text-right font-mono">{num(r.milhas)}</TableCell>
                        <TableCell className="text-right font-mono">{brl(r.milheiro)}</TableCell>
                        <TableCell className="text-right font-mono">{brl(r.preco)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* Detalhe das emissões */}
          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detalhe das emissões</h2>
            <Card className="overflow-hidden">
              <div className="max-h-[520px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <SortableHead label="ID" sortKey="id" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Data" sortKey="data_emissao" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Programa" sortKey="programa" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Operação" sortKey="nome_operacao" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Status" sortKey="status_pix" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Emissor" sortKey="emissor" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Conta" sortKey="conta" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Cliente" sortKey="cliente" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Cartão" sortKey="cartao" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Pax" sortKey="passageiros_qtd" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} align="right" className="text-right" />
                      <SortableHead label="Milhas cob." sortKey="milhas_cobrado" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} align="right" className="text-right" />
                      <SortableHead label="Taxas cob." sortKey="taxas_cobrado" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} align="right" className="text-right" />
                      <SortableHead label="Outros cob." sortKey="outros_cobrado" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} align="right" className="text-right" />
                      <SortableHead label="Preço total" sortKey="preco_total" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} align="right" className="text-right" />
                      <SortableHead label="Recebido" sortKey="valor_recebido" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} align="right" className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sdet.sorted.length === 0 ? (
                      <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-6">Nenhuma emissão com os filtros atuais.</TableCell></TableRow>
                    ) : sdet.sorted.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{r.id}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{r.data_emissao ? format(new Date(r.data_emissao + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.programa}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.nome_operacao}</TableCell>
                        <TableCell>{statusBadge(r.status_pix)}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.emissor}</TableCell>
                        <TableCell className="font-mono text-xs">{r.conta}</TableCell>
                        <TableCell className="font-mono text-xs">{r.cliente}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.cartao}</TableCell>
                        <TableCell className="text-right font-mono">{num(r.passageiros_qtd)}</TableCell>
                        <TableCell className="text-right font-mono">{num(r.milhas_cobrado)}</TableCell>
                        <TableCell className="text-right font-mono">{brl(r.taxas_cobrado)}</TableCell>
                        <TableCell className="text-right font-mono">{brl(r.outros_cobrado)}</TableCell>
                        <TableCell className="text-right font-mono">{brl(r.preco_total)}</TableCell>
                        <TableCell className="text-right font-mono">{brl(r.valor_recebido)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground pb-2">{filtered.length} emissão(ões) no filtro. Use os filtros (série BR/GL, data, programa, etc.) para conferir os totais contra a planilha de origem.</p>
        </>
      )}
    </div>
  );
}
