import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEstoqueCompras, useExcluirCompra } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchBar } from "@/components/ui/search-bar";
import { SearchSelect } from "@/components/ui/search-select";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { AjudaButton } from "@/components/AjudaButton";
import { CampoFiltro, FiltroPeriodo, TotalCard, noPeriodo, isoHojeLocal } from "@/components/estoque/ValidacaoEstoque";
import { useSearch } from "@/hooks/useSearch";
import { usePagination } from "@/hooks/usePagination";
import { useSort } from "@/hooks/useSort";
import { SortableHead } from "@/components/ui/sortable-head";
import { exportarExcel, type ColunaExcel } from "@/lib/exportarExcel";
import { Plus, Trash2, Pencil, Download, X } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";
import { rotuloConta } from "@/lib/rotuloConta";

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const brl = (n: number | null | undefined) =>
  n == null ? "—" : (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const formaPgto = (c: any) => (c.meio_pagamento === "pix" ? `Pix${c.bancos?.nome ? " · " + c.bancos.nome : ""}` : (c.forma_pagamento || "—"));
const porCodigo = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "pt-BR", { numeric: true });

export default function ComprasPage() {
  const navigate = useNavigate();
  const { data: compras, isLoading } = useEstoqueCompras();
  const excluir = useExcluirCompra();
  const podeExcluir = usePodeExcluir();

  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fConta, setFConta] = useState("");
  const [fProg, setFProg] = useState("");
  const [fOp, setFOp] = useState("");

  const rows = useMemo(() => (compras ?? []).map((c: any) => ({
    ...c,
    _conta: `${c.contas?.codigo ?? ""} ${c.contas?.nome ?? ""}`.trim(),
    _estoque: c.programas_estoque?.nome ?? "",
    // chaves de ordenação (valor bruto)
    _sData: c.data ? `${c.data}T${c.hora ?? ""}` : null,
    _sConta: c.contas?.codigo ?? null,
    _sOperacao: c.operacao || null,
    _sQtde: Number(c.qtde) || 0,
    _sCusto: c.custo_total == null ? null : Number(c.custo_total),
    _sParcelas: c.num_parcelas == null ? null : Number(c.num_parcelas),
    _sForma: formaPgto(c),
    _sVlrParcela: c.valor_parcela == null ? null : Number(c.valor_parcela),
    _sCm: c.custo_milheiro ? Number(c.custo_milheiro) : null,
    _sDescricao: c.descricao || null,
    // Crédito dos pontos (Conferência Compras): pendente ou data/hora em que entrou no estoque
    _sCredito: c.creditado === false ? "0" : `1${c.creditado_data ?? c.data ?? ""}T${c.creditado_hora ?? c.hora ?? ""}`,
  })), [compras]);

  // Opções dos filtros saem das próprias compras lançadas.
  const contaOptions = useMemo(() => {
    const m = new Map<string, any>();
    rows.forEach((r: any) => { if (r.conta_id && !m.has(r.conta_id)) m.set(r.conta_id, { value: r.conta_id, label: rotuloConta(r.contas) || "?", searchText: r.contas?.nome ?? "" }); });
    return [{ value: "", label: "Todas as contas" }, ...[...m.values()].sort(porCodigo)];
  }, [rows]);
  const progOptions = useMemo(() => {
    const m = new Map<string, any>();
    rows.forEach((r: any) => { if (r.programa_estoque_id && !m.has(r.programa_estoque_id)) m.set(r.programa_estoque_id, { value: r.programa_estoque_id, label: r._estoque }); });
    return [{ value: "", label: "Todos os programas" }, ...[...m.values()].sort(porCodigo)];
  }, [rows]);
  const opOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r: any) => s.add(r.operacao || "(sem operação)"));
    return [{ value: "", label: "Todas as operações" }, ...[...s].sort().map((o) => ({ value: o, label: o }))];
  }, [rows]);

  const porFiltro = useMemo(() => rows.filter((r: any) =>
    noPeriodo(r.data, fDe, fAte)
    && (!fConta || r.conta_id === fConta)
    && (!fProg || r.programa_estoque_id === fProg)
    && (!fOp || (r.operacao || "(sem operação)") === fOp),
  ), [rows, fDe, fAte, fConta, fProg, fOp]);
  const { query, setQuery, filtered } = useSearch<any>(porFiltro, ["id_compra", "_conta", "_estoque", "forma_pagamento", "descricao", "operacao"]);
  // Sem coluna escolhida, mantém a ordem que vem do banco.
  const { sorted, key: sKey, dir: sDir, toggle: sToggle } = useSort<any>(filtered, null);
  const { page, setPage, totalPages, paged, total, from, to } = usePagination<any>(sorted, 100);

  // Totais do que está filtrado — é o número para bater com a planilha.
  const tot = useMemo(() => {
    let milhas = 0, custo = 0;
    filtered.forEach((c: any) => { milhas += Number(c.qtde) || 0; custo += Number(c.custo_total) || 0; });
    return { n: filtered.length, milhas, custo, cm: milhas > 0 ? custo / (milhas / 1000) : 0 };
  }, [filtered]);
  const porOperacao = useMemo(() => {
    const m = new Map<string, { op: string; n: number; milhas: number; custo: number }>();
    filtered.forEach((c: any) => {
      const op = c.operacao || "(sem operação)";
      const e = m.get(op) ?? { op, n: 0, milhas: 0, custo: 0 };
      e.n += 1; e.milhas += Number(c.qtde) || 0; e.custo += Number(c.custo_total) || 0;
      m.set(op, e);
    });
    return [...m.values()].sort((a, b) => b.milhas - a.milhas);
  }, [filtered]);
  const { sorted: porOperacaoOrd, key: oKey, dir: oDir, toggle: oToggle } = useSort<any>(porOperacao, null);

  const temFiltro = !!(fDe || fAte || fConta || fProg || fOp || query);
  const limpar = () => { setFDe(""); setFAte(""); setFConta(""); setFProg(""); setFOp(""); setQuery(""); };

  const exportar = () => {
    const colunas: ColunaExcel<any>[] = [
      { header: "Código", key: "id_compra" },
      { header: "Data", key: "data", tipo: "data" },
      { header: "Hora", key: "hora" },
      { header: "Conta", key: "conta" },
      { header: "Nome da conta", key: "nome", largura: 30 },
      { header: "Programa", key: "programa" },
      { header: "Operação", key: "operacao", largura: 24 },
      { header: "Qtde", key: "qtde", tipo: "inteiro" },
      { header: "Custo total", key: "custo_total", tipo: "moeda" },
      { header: "Parcelas", key: "num_parcelas", tipo: "inteiro" },
      { header: "Forma pgto", key: "forma", largura: 22 },
      { header: "Valor parcela", key: "valor_parcela", tipo: "moeda" },
      { header: "Custo milheiro", key: "custo_milheiro", tipo: "moeda" },
      { header: "Descrição", key: "descricao", largura: 34 },
      { header: "Crédito", key: "credito", largura: 14 },
    ];
    const linhas = filtered.map((c: any) => ({
      id_compra: c.id_compra, data: c.data, hora: c.hora ? String(c.hora).slice(0, 5) : "",
      conta: c.contas?.codigo ?? "", nome: c.contas?.nome ?? "", programa: c._estoque, operacao: c.operacao ?? "",
      qtde: Number(c.qtde) || 0, custo_total: c.custo_total, num_parcelas: c.num_parcelas, forma: formaPgto(c),
      valor_parcela: c.valor_parcela, custo_milheiro: c.custo_milheiro, descricao: c.descricao ?? "",
      credito: c.creditado === false ? "Aguardando" : fmtData(c.creditado_data ?? c.data),
    }));
    exportarExcel(`compras-${isoHojeLocal()}`, colunas, linhas, "Compras");
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir esta compra? Ela deixa de contar no estoque.")) return;
    try { await excluir.mutateAsync(id); toast.success("Compra removida."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao excluir"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Compras</h1><AjudaButton chave="estoque_compras" />
        </div>
        <Button onClick={() => navigate("/estoque-compras/nova")}><Plus className="h-4 w-4 mr-2" />Nova compra</Button>
      </div>

      <p className="text-sm text-muted-foreground">Entrada de milhas por compra/assinatura. Cada compra soma no estoque da conta e programa. Use os filtros para conferir os totais.</p>

      <div className="flex flex-wrap items-end gap-2">
        <FiltroPeriodo de={fDe} ate={fAte} onDe={setFDe} onAte={setFAte} />
        <CampoFiltro label="Conta">
          <SearchSelect className="w-72" value={fConta} onChange={setFConta} options={contaOptions} placeholder="Todas as contas" emptyText="Nenhuma conta" />
        </CampoFiltro>
        <CampoFiltro label="Programa">
          <SearchSelect className="w-44" value={fProg} onChange={setFProg} options={progOptions} placeholder="Todos os programas" emptyText="Nenhum programa" />
        </CampoFiltro>
        <CampoFiltro label="Operação">
          <SearchSelect className="w-52" value={fOp} onChange={setFOp} options={opOptions} placeholder="Todas as operações" emptyText="Nenhuma operação" />
        </CampoFiltro>
        <CampoFiltro label="Pesquisa">
          <SearchBar value={query} onChange={setQuery} placeholder="Código, conta, descrição..." />
        </CampoFiltro>
        {temFiltro && <Button variant="ghost" onClick={limpar}><X className="h-4 w-4 mr-1" />Limpar filtros</Button>}
        <Button variant="outline" className="ml-auto" onClick={exportar} disabled={filtered.length === 0}><Download className="h-4 w-4 mr-2" />Exportar Excel</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TotalCard titulo="Lançamentos" valor={nf(tot.n)} dica="Quantidade de compras que passam pelos filtros acima." />
        <TotalCard titulo="Milhas" valor={`+${nf(tot.milhas)}`} tom="pos" dica="Soma da coluna Qtde das compras filtradas. É o que essas compras somaram no estoque (cancelamentos entram negativos)." />
        <TotalCard titulo="Custo total" valor={brl(tot.custo)} dica="Soma da coluna Custo total das compras filtradas (bônus e lançamentos sem custo contam R$ 0)." />
        <TotalCard titulo="Custo médio do milheiro" valor={tot.milhas > 0 ? brl(tot.cm) : "—"} dica="Custo total ÷ (Milhas ÷ 1.000), sobre as compras filtradas. Bônus sem custo baixam a média — filtre a operação para ver o custo de cada tipo." />
      </div>

      {porOperacao.length > 1 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2 text-sm font-medium bg-muted/40">Resumo por operação <span className="text-xs text-muted-foreground font-normal">— clique numa linha para filtrar</span></div>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Operação" sortKey="op" activeKey={oKey} dir={oDir} onSort={oToggle} />
                <SortableHead label="Lançamentos" sortKey="n" activeKey={oKey} dir={oDir} onSort={oToggle} className="text-right" align="right" />
                <SortableHead label="Milhas" sortKey="milhas" activeKey={oKey} dir={oDir} onSort={oToggle} className="text-right" align="right" />
                <SortableHead label="Custo total" sortKey="custo" activeKey={oKey} dir={oDir} onSort={oToggle} className="text-right" align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {porOperacaoOrd.map((o: any) => (
                <TableRow key={o.op} className="cursor-pointer" onClick={() => setFOp(o.op)}>
                  <TableCell className="py-1.5">{o.op}</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums">{nf(o.n)}</TableCell>
                  <TableCell className={`py-1.5 text-right tabular-nums ${o.milhas < 0 ? "text-destructive" : "text-emerald-600"}`}>{o.milhas < 0 ? "" : "+"}{nf(o.milhas)}</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums">{brl(o.custo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Código" sortKey="id_compra" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Data" sortKey="_sData" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Conta" sortKey="_sConta" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Programa" sortKey="_estoque" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Operação" sortKey="_sOperacao" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Qtde" sortKey="_sQtde" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />
              <SortableHead label="Custo total" sortKey="_sCusto" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />
              <SortableHead label="Parcelas" sortKey="_sParcelas" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />
              <SortableHead label="Forma pgto" sortKey="_sForma" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Vlr parcela" sortKey="_sVlrParcela" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />
              <SortableHead label="Custo milheiro" sortKey="_sCm" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />
              <SortableHead label="Descrição" sortKey="_sDescricao" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Crédito" sortKey="_sCredito" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-6">{temFiltro ? "Nenhuma compra com esses filtros" : "Nenhuma compra lançada"}</TableCell></TableRow>
            ) : paged.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="py-2 font-mono">{c.id_compra || "—"}</TableCell>
                <TableCell className="py-2">{fmtData(c.data)}</TableCell>
                <TableCell className="py-2"><span className="font-mono font-semibold text-base">{c.contas?.codigo}</span></TableCell>
                <TableCell className="py-2">{c.programas_estoque?.nome}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.operacao || "—"}</TableCell>
                <TableCell className={`py-2 text-right tabular-nums ${(Number(c.qtde) || 0) < 0 ? "text-destructive" : "text-emerald-600"}`}>{(Number(c.qtde) || 0) < 0 ? "" : "+"}{nf(c.qtde)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{brl(c.custo_total)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{c.num_parcelas ?? "—"}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{formaPgto(c)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{brl(c.valor_parcela)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{c.custo_milheiro ? brl(c.custo_milheiro) : "—"}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.descricao || "—"}</TableCell>
                <TableCell className="py-2 whitespace-nowrap">
                  {c.creditado === false
                    ? <span className="text-amber-600">Aguardando</span>
                    : <span className="text-muted-foreground">{fmtData(c.creditado_data ?? c.data)}</span>}
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/estoque-compras/${c.id}/editar`)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleExcluir(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
      </Card>
    </div>
  );
}
