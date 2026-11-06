import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEstoqueTransferencias, useExcluirTransferencia } from "@/hooks/useClubes";
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

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const brl = (n: number | null | undefined) =>
  n == null ? "—" : (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (frac: number) => `${((Number(frac) || 0) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const porCodigo = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "pt-BR", { numeric: true });
// O que sai do estoque de origem: o total transferido menos o carrinho (o carrinho foi comprado na hora).
const saiDaOrigem = (t: any) => Math.max(0, (Number(t.qtde_transferida) || 0) - (Number(t.carrinho_qtde) || 0));
const TIPO_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "integral", label: "Integral (sem carrinho)" },
  { value: "carrinho", label: "Com carrinho" },
];

export default function TransferenciasPage() {
  const navigate = useNavigate();
  const { data: transfers, isLoading } = useEstoqueTransferencias();
  const excluir = useExcluirTransferencia();
  const podeExcluir = usePodeExcluir();

  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fConta, setFConta] = useState("");
  const [fOrigem, setFOrigem] = useState("");
  const [fDestino, setFDestino] = useState("");
  const [fTipo, setFTipo] = useState("");

  const rows = useMemo(() => (transfers ?? []).map((t: any) => ({
    ...t,
    _origem: `${t.remetente?.codigo ?? ""} ${t.remetente?.nome ?? ""} ${t.prog_remetente?.nome ?? ""}`.trim(),
    _destino: `${t.recebedora?.codigo ?? ""} ${t.recebedora?.nome ?? ""} ${t.prog_recebedor?.nome ?? ""}`.trim(),
    // chaves de ordenação (valor bruto)
    _sData: t.data ? `${t.data}T${t.hora ?? ""}` : null,
    _sOrigem: `${t.remetente?.codigo ?? ""} ${t.prog_remetente?.nome ?? ""}`.trim() || null,
    _sDestino: `${t.recebedora?.codigo ?? ""} ${t.prog_recebedor?.nome ?? ""}`.trim() || null,
    _sSai: saiDaOrigem(t),
    _sBonus: t.bonus ? Number(t.bonus) : null,
    _sCarrinho: Number(t.carrinho_qtde) || null,
    _sRecebida: Number(t.qtde_recebida) || 0,
    _sCusto: Number(t.custo_total) || null,
    _sDescricao: t.descricao || null,
  })), [transfers]);

  const contaOptions = useMemo(() => {
    const m = new Map<string, any>();
    const add = (id: string, c: any) => { if (id && !m.has(id)) m.set(id, { value: id, label: c?.codigo ?? "?", searchText: c?.nome ?? "" }); };
    rows.forEach((r: any) => { add(r.conta_remetente_id, r.remetente); add(r.conta_recebedora_id, r.recebedora); });
    return [{ value: "", label: "Todas as contas" }, ...[...m.values()].sort(porCodigo)];
  }, [rows]);
  const origemOptions = useMemo(() => {
    const m = new Map<string, any>();
    rows.forEach((r: any) => { if (r.programa_estoque_remetente_id && !m.has(r.programa_estoque_remetente_id)) m.set(r.programa_estoque_remetente_id, { value: r.programa_estoque_remetente_id, label: r.prog_remetente?.nome ?? "?" }); });
    return [{ value: "", label: "Todas as origens" }, ...[...m.values()].sort(porCodigo)];
  }, [rows]);
  const destinoOptions = useMemo(() => {
    const m = new Map<string, any>();
    rows.forEach((r: any) => { if (r.programa_estoque_recebedor_id && !m.has(r.programa_estoque_recebedor_id)) m.set(r.programa_estoque_recebedor_id, { value: r.programa_estoque_recebedor_id, label: r.prog_recebedor?.nome ?? "?" }); });
    return [{ value: "", label: "Todos os destinos" }, ...[...m.values()].sort(porCodigo)];
  }, [rows]);

  const porFiltro = useMemo(() => rows.filter((r: any) =>
    noPeriodo(r.data, fDe, fAte)
    && (!fConta || r.conta_remetente_id === fConta || r.conta_recebedora_id === fConta)
    && (!fOrigem || r.programa_estoque_remetente_id === fOrigem)
    && (!fDestino || r.programa_estoque_recebedor_id === fDestino)
    && (!fTipo || (fTipo === "carrinho" ? (Number(r.carrinho_qtde) || 0) > 0 : !(Number(r.carrinho_qtde) || 0))),
  ), [rows, fDe, fAte, fConta, fOrigem, fDestino, fTipo]);
  const { query, setQuery, filtered } = useSearch<any>(porFiltro, ["id_transferencia", "_origem", "_destino", "descricao"]);
  // Sem coluna escolhida, mantém a ordem que vem do banco.
  const { sorted, key: sKey, dir: sDir, toggle: sToggle } = useSort<any>(filtered, null);
  const { page, setPage, totalPages, paged, total, from, to } = usePagination<any>(sorted, 100);

  const tot = useMemo(() => {
    const t = { n: 0, transferida: 0, sai: 0, carrinho: 0, bonus: 0, recebida: 0, custo: 0 };
    filtered.forEach((r: any) => {
      t.n += 1;
      t.transferida += Number(r.qtde_transferida) || 0;
      t.sai += saiDaOrigem(r);
      t.carrinho += Number(r.carrinho_qtde) || 0;
      t.bonus += Number(r.bonus_milhas) || 0;
      t.recebida += Number(r.qtde_recebida) || 0;
      t.custo += Number(r.custo_total) || 0;
    });
    return t;
  }, [filtered]);
  // Resumo no formato da tabela dinâmica da planilha: origem (com subtotal) → destinos, e Total Geral.
  const resumo = useMemo(() => {
    const vazio = () => ({ n: 0, sai: 0, carrinho: 0, bonus: 0, recebida: 0, custo: 0 });
    const soma = (e: any, r: any) => {
      e.n += 1; e.sai += saiDaOrigem(r); e.carrinho += Number(r.carrinho_qtde) || 0; e.bonus += Number(r.bonus_milhas) || 0;
      e.recebida += Number(r.qtde_recebida) || 0; e.custo += Number(r.custo_total) || 0;
    };
    const origens = new Map<string, any>();
    const total = vazio();
    filtered.forEach((r: any) => {
      const on = r.prog_remetente?.nome ?? "?";
      const dn = r.prog_recebedor?.nome ?? "?";
      let o = origens.get(on);
      if (!o) { o = { nome: on, id: r.programa_estoque_remetente_id, ...vazio(), destinos: new Map<string, any>() }; origens.set(on, o); }
      let d = o.destinos.get(dn);
      if (!d) { d = { nome: dn, id: r.programa_estoque_recebedor_id, ...vazio() }; o.destinos.set(dn, d); }
      soma(o, r); soma(d, r); soma(total, r);
    });
    const porNome = (a: any, b: any) => a.nome.localeCompare(b.nome, "pt-BR");
    const lista = [...origens.values()].sort(porNome).map((o: any) => ({ ...o, destinos: [...o.destinos.values()].sort(porNome) }));
    return { lista, total };
  }, [filtered]);
  // Ordenação do resumo: ordena as origens e, dentro de cada uma, os destinos pela mesma coluna.
  const { sorted: origensOrd, key: rKey, dir: rDir, toggle: rToggle } = useSort<any>(resumo.lista, null);
  const destinosOrd = (lista: any[]) => {
    if (!rKey) return lista;
    return [...lista].sort((a: any, b: any) => {
      const va = a?.[rKey], vb = b?.[rKey];
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", { numeric: true, sensitivity: "base" });
      return rDir === "asc" ? cmp : -cmp;
    });
  };

  const temFiltro = !!(fDe || fAte || fConta || fOrigem || fDestino || fTipo || query);
  const limpar = () => { setFDe(""); setFAte(""); setFConta(""); setFOrigem(""); setFDestino(""); setFTipo(""); setQuery(""); };

  const exportar = () => {
    const colunas: ColunaExcel<any>[] = [
      { header: "Código", key: "id_transferencia" },
      { header: "Data", key: "data", tipo: "data" },
      { header: "Hora", key: "hora" },
      { header: "Conta origem", key: "conta_origem" },
      { header: "Programa origem", key: "prog_origem" },
      { header: "Conta destino", key: "conta_destino" },
      { header: "Programa destino", key: "prog_destino" },
      { header: "Qtde transferida (total)", key: "qtde_transferida", tipo: "inteiro", largura: 24 },
      { header: "Carrinho %", key: "carrinho_pct", tipo: "decimal" },
      { header: "Carrinho (milhas)", key: "carrinho_qtde", tipo: "inteiro" },
      { header: "Sai da origem", key: "sai", tipo: "inteiro" },
      { header: "Conversão (pontos por 1)", key: "fator", tipo: "decimal", largura: 24 },
      { header: "Bônus %", key: "bonus_pct", tipo: "decimal" },
      { header: "Bônus (milhas)", key: "bonus_milhas", tipo: "inteiro" },
      { header: "Recebida", key: "qtde_recebida", tipo: "inteiro" },
      { header: "Custo do carrinho", key: "custo_total", tipo: "moeda" },
      { header: "Parcelas", key: "num_parcelas", tipo: "inteiro" },
      { header: "Forma pgto", key: "forma", largura: 22 },
      { header: "Descrição", key: "descricao", largura: 34 },
    ];
    const linhas = filtered.map((t: any) => ({
      id_transferencia: t.id_transferencia, data: t.data, hora: t.hora ? String(t.hora).slice(0, 5) : "",
      conta_origem: t.remetente?.codigo ?? "", prog_origem: t.prog_remetente?.nome ?? "",
      conta_destino: t.recebedora?.codigo ?? "", prog_destino: t.prog_recebedor?.nome ?? "",
      qtde_transferida: Number(t.qtde_transferida) || 0, carrinho_pct: (Number(t.carrinho) || 0) * 100, carrinho_qtde: Number(t.carrinho_qtde) || 0,
      sai: saiDaOrigem(t), fator: Number(t.fator_conversao) || 1, bonus_pct: (Number(t.bonus) || 0) * 100, bonus_milhas: Number(t.bonus_milhas) || 0,
      qtde_recebida: Number(t.qtde_recebida) || 0, custo_total: t.custo_total, num_parcelas: t.num_parcelas,
      forma: t.meio_pagamento === "pix" ? `Pix${t.bancos?.nome ? " · " + t.bancos.nome : ""}` : (t.forma_pagamento ?? ""), descricao: t.descricao ?? "",
    }));
    exportarExcel(`transferencias-${isoHojeLocal()}`, colunas, linhas, "Transferências");
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir esta transferência? Ela deixa de contar no estoque.")) return;
    try { await excluir.mutateAsync(id); toast.success("Transferência removida."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao excluir"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Transferências</h1><AjudaButton chave="estoque_transferencias" />
        </div>
        <Button onClick={() => navigate("/estoque-transferencias/nova")}><Plus className="h-4 w-4 mr-2" />Nova transferência</Button>
      </div>

      <p className="text-sm text-muted-foreground">A transferência sai de um programa e entra em outro: diminui a origem e soma no destino (já com o bônus). Use os filtros para conferir os totais.</p>

      <div className="flex flex-wrap items-end gap-2">
        <FiltroPeriodo de={fDe} ate={fAte} onDe={setFDe} onAte={setFAte} />
        <CampoFiltro label="Conta (origem ou destino)">
          <SearchSelect className="w-44" value={fConta} onChange={setFConta} options={contaOptions} placeholder="Todas as contas" emptyText="Nenhuma conta" />
        </CampoFiltro>
        <CampoFiltro label="Programa origem">
          <SearchSelect className="w-40" value={fOrigem} onChange={setFOrigem} options={origemOptions} placeholder="Todas as origens" emptyText="Nenhum programa" />
        </CampoFiltro>
        <CampoFiltro label="Programa destino">
          <SearchSelect className="w-40" value={fDestino} onChange={setFDestino} options={destinoOptions} placeholder="Todos os destinos" emptyText="Nenhum programa" />
        </CampoFiltro>
        <CampoFiltro label="Tipo">
          <SearchSelect className="w-48" value={fTipo} onChange={setFTipo} options={TIPO_OPTIONS} placeholder="Todas" />
        </CampoFiltro>
        <CampoFiltro label="Pesquisa">
          <SearchBar value={query} onChange={setQuery} placeholder="Código, conta, descrição..." />
        </CampoFiltro>
        {temFiltro && <Button variant="ghost" onClick={limpar}><X className="h-4 w-4 mr-1" />Limpar filtros</Button>}
        <Button variant="outline" className="ml-auto" onClick={exportar} disabled={filtered.length === 0}><Download className="h-4 w-4 mr-2" />Exportar Excel</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <TotalCard titulo="Lançamentos" valor={nf(tot.n)} dica="Quantidade de transferências que passam pelos filtros acima." />
        <TotalCard titulo="Sai da origem" valor={`-${nf(tot.sai)}`} tom="neg" dica="Soma de (Qtde transferida − Carrinho) das transferências filtradas. É o que sai do estoque do programa de origem; o carrinho foi comprado na hora e não sai do estoque." />
        <TotalCard titulo="Carrinho" valor={nf(tot.carrinho)} dica="Soma das milhas compradas no carrinho das transferências filtradas. Elas entram no total transferido, mas não saem do estoque de origem." />
        <TotalCard titulo="Bônus" valor={`+${nf(tot.bonus)}`} tom="pos" dica="Soma das milhas de bônus das transferências filtradas: (Qtde transferida ÷ conversão) × % de bônus, já com o teto da promoção quando houver." />
        <TotalCard titulo="Recebida no destino" valor={`+${nf(tot.recebida)}`} tom="pos" dica="Soma da Qtde recebida das transferências filtradas = (Qtde transferida ÷ conversão) + bônus. É o que entra no estoque do programa de destino." />
        <TotalCard titulo="Custo do carrinho" valor={brl(tot.custo)} dica="Soma do Custo total das transferências filtradas (o valor pago pelo carrinho; transferência integral tem custo R$ 0)." />
      </div>

      {resumo.lista.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2 text-sm font-medium bg-muted/40">Resumo por origem → destino <span className="text-xs text-muted-foreground font-normal">— mesmo formato da tabela dinâmica da planilha; clique numa linha para filtrar</span></div>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Origem → Destino" sortKey="nome" activeKey={rKey} dir={rDir} onSort={rToggle} />
                <SortableHead label="Lançamentos" sortKey="n" activeKey={rKey} dir={rDir} onSort={rToggle} className="text-right" align="right" />
                <SortableHead label="Sai da origem" sortKey="sai" activeKey={rKey} dir={rDir} onSort={rToggle} className="text-right" align="right" />
                <SortableHead label="Carrinho (milhas)" sortKey="carrinho" activeKey={rKey} dir={rDir} onSort={rToggle} className="text-right" align="right" />
                <SortableHead label="Bônus no destino" sortKey="bonus" activeKey={rKey} dir={rDir} onSort={rToggle} className="text-right" align="right" />
                <SortableHead label="Recebida no destino" sortKey="recebida" activeKey={rKey} dir={rDir} onSort={rToggle} className="text-right" align="right" />
                <SortableHead label="Custo do carrinho" sortKey="custo" activeKey={rKey} dir={rDir} onSort={rToggle} className="text-right" align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {origensOrd.map((o: any) => (
                <Fragment key={o.nome}>
                  <TableRow className="cursor-pointer font-semibold bg-muted/20" onClick={() => { setFOrigem(o.id ?? ""); setFDestino(""); }}>
                    <TableCell className="py-1.5">{o.nome}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{nf(o.n)}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{nf(o.sai)}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{nf(o.carrinho)}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{nf(o.bonus)}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{nf(o.recebida)}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{brl(o.custo)}</TableCell>
                  </TableRow>
                  {destinosOrd(o.destinos).map((d: any) => (
                    <TableRow key={o.nome + "|" + d.nome} className="cursor-pointer" onClick={() => { setFOrigem(o.id ?? ""); setFDestino(d.id ?? ""); }}>
                      <TableCell className="py-1.5 pl-8 text-muted-foreground">{d.nome}</TableCell>
                      <TableCell className="py-1.5 text-right tabular-nums">{nf(d.n)}</TableCell>
                      <TableCell className="py-1.5 text-right tabular-nums">{nf(d.sai)}</TableCell>
                      <TableCell className="py-1.5 text-right tabular-nums">{nf(d.carrinho)}</TableCell>
                      <TableCell className="py-1.5 text-right tabular-nums">{nf(d.bonus)}</TableCell>
                      <TableCell className="py-1.5 text-right tabular-nums">{nf(d.recebida)}</TableCell>
                      <TableCell className="py-1.5 text-right tabular-nums">{brl(d.custo)}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell className="py-2">Total Geral</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{nf(resumo.total.n)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{nf(resumo.total.sai)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{nf(resumo.total.carrinho)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{nf(resumo.total.bonus)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{nf(resumo.total.recebida)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{brl(resumo.total.custo)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Código" sortKey="id_transferencia" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Data" sortKey="_sData" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Origem (−)" sortKey="_sOrigem" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Destino (+)" sortKey="_sDestino" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Sai da origem" sortKey="_sSai" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />
              <SortableHead label="Bônus" sortKey="_sBonus" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />
              <SortableHead label="Carrinho" sortKey="_sCarrinho" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />
              <SortableHead label="Recebida" sortKey="_sRecebida" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />
              <SortableHead label="Custo" sortKey="_sCusto" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />
              <SortableHead label="Descrição" sortKey="_sDescricao" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">{temFiltro ? "Nenhuma transferência com esses filtros" : "Nenhuma transferência lançada"}</TableCell></TableRow>
            ) : paged.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="py-2 font-mono">{t.id_transferencia || "—"}</TableCell>
                <TableCell className="py-2">{fmtData(t.data)}</TableCell>
                <TableCell className="py-2">
                  <span className="font-mono font-semibold text-base">{t.remetente?.codigo}</span>
                  <span className="text-muted-foreground"> · {t.prog_remetente?.nome}</span>
                </TableCell>
                <TableCell className="py-2">
                  <span className="font-mono font-semibold text-base">{t.recebedora?.codigo}</span>
                  <span className="text-muted-foreground"> · {t.prog_recebedor?.nome}</span>
                </TableCell>
                <TableCell className="py-2 text-right tabular-nums text-destructive">-{nf(saiDaOrigem(t))}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{t.bonus ? pct(t.bonus) : "—"}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{t.carrinho ? `${pct(t.carrinho)} · ${nf(t.carrinho_qtde)}` : "—"}</TableCell>
                <TableCell className="py-2 text-right tabular-nums text-emerald-600">+{nf(t.qtde_recebida)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{Number(t.custo_total) ? brl(t.custo_total) : "—"}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{t.descricao || "—"}</TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/estoque-transferencias/${t.id}/editar`)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleExcluir(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
