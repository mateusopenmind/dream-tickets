import { useState, useMemo } from "react";
import { useRecebimentosAvulsos, useBancos } from "@/hooks/useData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { AjudaButton } from "@/components/AjudaButton";
import { Search, Download, Loader2, X } from "lucide-react";
import { format } from "date-fns";

interface Row {
  id: string;
  id_emissao: string;
  tabela_origem: string;
  cliente_codigo: string;
  cliente_nome: string;
  numero_parcela: number;
  total_parcelas: number;
  status: string;
  data_prevista: string | null;
  data_recebimento: string | null;
  banco: string;
  valor: number;
}

const ALL = "__all";
const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function RelatorioRecebimentosPage() {
  const { data: pagamentos, isLoading } = useRecebimentosAvulsos();
  const { data: bancos } = useBancos();

  const [fStatus, setFStatus] = useState(ALL);
  const [fBanco, setFBanco] = useState(ALL);
  const [fTabela, setFTabela] = useState(ALL);
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [busca, setBusca] = useState("");

  const rows: Row[] = useMemo(
    () =>
      (pagamentos ?? []).map((p: any) => ({
        id: p.id,
        id_emissao: p.id_emissao ?? "",
        tabela_origem: p.tabela_origem === "emissoes_terceirizadas" ? "Terceirizada" : "Normal",
        cliente_codigo: p.clientes?.codigo ?? "",
        cliente_nome: p.clientes?.nome_fantasia ?? "",
        numero_parcela: p.numero_parcela,
        total_parcelas: p.total_parcelas,
        status: p.status === "recebido" ? "RECEBIDO" : "PREVISTO",
        data_prevista: p.data_prevista,
        data_recebimento: p.data_recebimento,
        banco: p.banco ?? "",
        valor: Number(p.valor) || 0,
      })),
    [pagamentos]
  );

  const opts = (k: keyof Row) =>
    Array.from(new Set(rows.map((r) => r[k] as string))).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));

  const filtered = useMemo(() => {
    let list = [...rows];
    if (fStatus !== ALL) list = list.filter((r) => r.status === fStatus);
    if (fBanco !== ALL) list = list.filter((r) => r.banco === fBanco);
    if (fTabela !== ALL) list = list.filter((r) => r.tabela_origem === fTabela);
    if (fDe) list = list.filter((r) => (r.data_recebimento || r.data_prevista || "") >= fDe);
    if (fAte) list = list.filter((r) => (r.data_recebimento || r.data_prevista || "") <= fAte);
    if (busca.trim()) {
      const s = busca.toLowerCase();
      list = list.filter((r) => [r.id_emissao, r.cliente_codigo, r.cliente_nome, r.banco].some((c) => String(c ?? "").toLowerCase().includes(s)));
    }
    return list;
  }, [rows, fStatus, fBanco, fTabela, fDe, fAte, busca]);

  const temFiltro = fStatus !== ALL || fBanco !== ALL || fTabela !== ALL || fDe || fAte || busca.trim();
  const limpar = () => { setFStatus(ALL); setFBanco(ALL); setFTabela(ALL); setFDe(""); setFAte(""); setBusca(""); };

  const sdet = useSort<Row>(filtered);

  const previstos = filtered.filter((r) => r.status === "PREVISTO");
  const recebidos = filtered.filter((r) => r.status === "RECEBIDO");
  const somaPrevisto = previstos.reduce((a, r) => a + r.valor, 0);
  const somaRecebido = recebidos.reduce((a, r) => a + r.valor, 0);

  const somatorios = [
    { l: "Parcelas no filtro", v: String(filtered.length) },
    { l: "Previstas / Recebidas", v: `${previstos.length} / ${recebidos.length}` },
    { l: "Total previsto", v: brl(somaPrevisto) },
    { l: "Total recebido", v: brl(somaRecebido) },
    { l: "Total geral", v: brl(somaPrevisto + somaRecebido) },
  ];

  // agrupado por banco (só recebidos têm banco preenchido)
  const porBanco = useMemo(() => {
    const m = new Map<string, { qtd: number; valor: number }>();
    recebidos.forEach((r) => {
      const k = r.banco || "(sem banco)";
      if (!m.has(k)) m.set(k, { qtd: 0, valor: 0 });
      const g = m.get(k)!;
      g.qtd += 1; g.valor += r.valor;
    });
    return Array.from(m.entries()).sort((a, b) => b[1].valor - a[1].valor);
  }, [recebidos]);

  // agrupado por cliente
  const porCliente = useMemo(() => {
    const m = new Map<string, { qtd: number; valor: number }>();
    filtered.forEach((r) => {
      const k = r.cliente_nome || "(sem cliente)";
      if (!m.has(k)) m.set(k, { qtd: 0, valor: 0 });
      const g = m.get(k)!;
      g.qtd += 1; g.valor += r.valor;
    });
    return Array.from(m.entries()).sort((a, b) => b[1].valor - a[1].valor);
  }, [filtered]);

  const fmtData = (d: string | null) => (d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—");

  const exportarCSV = () => {
    const head = ["Emissão", "Tipo", "Cliente", "Parcela", "Status", "Data Prevista", "Data Recebimento", "Banco", "Valor"];
    const linhas = filtered.map((r) => [r.id_emissao, r.tabela_origem, `${r.cliente_codigo} ${r.cliente_nome}`, `${r.numero_parcela}/${r.total_parcelas}`, r.status, r.data_prevista ?? "", r.data_recebimento ?? "", r.banco, r.valor]);
    const csv = [head, ...linhas].map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-recebimentos-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (s: string) =>
    s === "RECEBIDO"
      ? <span className="inline-block rounded-full bg-success/15 text-success px-2 py-0.5 text-xs font-semibold">RECEBIDO</span>
      : <span className="inline-block rounded-full bg-warning/15 text-warning px-2 py-0.5 text-xs font-semibold">PREVISTO</span>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Relatório de Recebimentos</h1>
          <AjudaButton chave="relatorio_recebimentos" />
        </div>
        <Button variant="outline" onClick={exportarCSV} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos status</SelectItem>{opts("status").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fTabela} onValueChange={setFTabela}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tipo de emissão" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Normal + Terceirizada</SelectItem>{opts("tabela_origem").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fBanco} onValueChange={setFBanco}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Banco" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos bancos</SelectItem>{(bancos ?? []).map((b) => <SelectItem key={b.id} value={b.nome}>{b.nome}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Data de</label>
            <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Data até</label>
            <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="w-40" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Emissão, cliente, banco..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 w-52" />
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
          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Somatórios</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {somatorios.map((s) => (
                <Card key={s.l} className="p-3">
                  <p className="text-xs text-muted-foreground">{s.l}</p>
                  <p className="text-lg font-display font-bold text-foreground mt-1 truncate" title={s.v}>{s.v}</p>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recebido por banco</h2>
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Banco</TableHead><TableHead className="text-right">Parcelas</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {porBanco.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Nenhum recebimento no filtro.</TableCell></TableRow>
                  ) : porBanco.map(([nome, g]) => (
                    <TableRow key={nome}><TableCell className="font-medium">{nome}</TableCell><TableCell className="text-right font-mono">{g.qtd}</TableCell><TableCell className="text-right font-mono">{brl(g.valor)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por cliente</h2>
            <Card className="overflow-hidden">
              <div className="max-h-[360px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10"><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Parcelas</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {porCliente.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Nenhuma parcela no filtro.</TableCell></TableRow>
                    ) : porCliente.map(([nome, g]) => (
                      <TableRow key={nome}><TableCell className="font-medium">{nome}</TableCell><TableCell className="text-right font-mono">{g.qtd}</TableCell><TableCell className="text-right font-mono">{brl(g.valor)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          <div>
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detalhe das parcelas</h2>
            <Card className="overflow-hidden">
              <div className="max-h-[520px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <SortableHead label="Emissão" sortKey="id_emissao" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Tipo" sortKey="tabela_origem" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Cliente" sortKey="cliente_nome" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <TableHead>Parcela</TableHead>
                      <SortableHead label="Status" sortKey="status" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Data Prevista" sortKey="data_prevista" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Data Recebimento" sortKey="data_recebimento" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Banco" sortKey="banco" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} />
                      <SortableHead label="Valor" sortKey="valor" activeKey={sdet.key} dir={sdet.dir} onSort={sdet.toggle} align="right" className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sdet.sorted.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma parcela com os filtros atuais.</TableCell></TableRow>
                    ) : sdet.sorted.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{r.id_emissao}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{r.tabela_origem}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.cliente_codigo} {r.cliente_nome}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.numero_parcela}/{r.total_parcelas}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{fmtData(r.data_prevista)}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{fmtData(r.data_recebimento)}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.banco || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{brl(r.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground pb-2">{filtered.length} parcela(s) no filtro.</p>
        </>
      )}
    </div>
  );
}
