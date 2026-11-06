import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEstoqueCompras, useConfirmarCreditoCompra, useDesfazerCreditoCompra, compraCreditada } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchBar } from "@/components/ui/search-bar";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSearch } from "@/hooks/useSearch";
import { useSort } from "@/hooks/useSort";
import { usePodeExcluir } from "@/hooks/usePerfil";
import { vData } from "@/lib/validacoesData";
import { CheckCircle2, Undo2, Pencil } from "lucide-react";
import { toast } from "sonner";

// Conferência Compras: toda compra nasce aguardando o crédito dos pontos (alguns programas creditam
// semanas depois). Só depois de confirmada aqui ela entra no estoque — na data/hora do crédito.

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const brl = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");
const fmtHora = (h: string | null | undefined) => (h ? String(h).slice(0, 5) : "");
const isoHoje = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const horaAgora = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
};
// Dias corridos entre duas datas ISO (yyyy-mm-dd)
const diasEntre = (de: string | null | undefined, ate: string | null | undefined) => {
  if (!de || !ate) return null;
  const a = new Date(`${String(de).slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(`${String(ate).slice(0, 10)}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
};

export default function ConferenciaComprasPage() {
  const navigate = useNavigate();
  const { data: compras, isLoading } = useEstoqueCompras();
  const confirmar = useConfirmarCreditoCompra();
  const desfazer = useDesfazerCreditoCompra();
  const podeDesfazer = usePodeExcluir();

  const rows = useMemo(() => {
    const hoje = isoHoje();
    return (compras ?? []).map((c: any) => ({
      ...c,
      _conta: `${c.contas?.codigo ?? ""} ${c.contas?.nome ?? ""}`.trim(),
      _estoque: c.programas_estoque?.nome ?? "",
      _creditada: compraCreditada(c),
      // chaves de ordenação (valor bruto)
      _sData: c.data ? `${c.data}T${c.hora ?? ""}` : null,
      _sCredito: c.creditado_data ? `${c.creditado_data}T${c.creditado_hora ?? ""}` : null,
      _sConta: c.contas?.codigo ?? null,
      _sOperacao: c.operacao || null,
      _sQtde: Number(c.qtde) || 0,
      _sCusto: Number(c.custo_total) || 0,
      _sDias: compraCreditada(c) ? diasEntre(c.data, c.creditado_data) : diasEntre(c.data, hoje),
    }));
  }, [compras]);
  const campos = ["_conta", "_estoque", "operacao", "descricao", "id_compra"];

  // Aguardando crédito — mais antigas primeiro (são as mais atrasadas)
  const pendentes = useMemo(
    () => rows.filter((r: any) => !r._creditada).sort((a: any, b: any) => String(a._sData ?? "").localeCompare(String(b._sData ?? ""))),
    [rows]
  );
  const { query: qPend, setQuery: setQPend, filtered: pendFiltradas } = useSearch<any>(pendentes, campos);
  const { sorted: pendOrdenadas, key: kP, dir: dP, toggle: tP } = useSort<any>(pendFiltradas, null);

  // Creditadas (confirmadas aqui) — as mais recentes primeiro
  const creditadas = useMemo(
    () => rows.filter((r: any) => r._creditada && r.creditado_em)
      .sort((a: any, b: any) => String(b.creditado_em ?? "").localeCompare(String(a.creditado_em ?? ""))),
    [rows]
  );
  const { query: qCred, setQuery: setQCred, filtered: credFiltradas } = useSearch<any>(creditadas, campos);
  const { sorted: credOrdenadas, key: kC, dir: dC, toggle: tC } = useSort<any>(credFiltradas, null);

  const totalPendente = useMemo(() => pendFiltradas.reduce((s: number, r: any) => s + r._sQtde, 0), [pendFiltradas]);

  // Pop-up de confirmação: data e hora em que os pontos caíram (padrão: agora)
  const [confComp, setConfComp] = useState<any>(null);
  const [confData, setConfData] = useState("");
  const [confHora, setConfHora] = useState("");
  const abrirConfirmar = (c: any) => { setConfComp(c); setConfData(isoHoje()); setConfHora(horaAgora()); };
  const salvarConfirmacao = async () => {
    if (!confComp) return;
    if (!confData) { toast.error("Informe a data do crédito."); return; }
    const erro = vData(confData, "data do crédito"); if (erro) { toast.error(erro); return; }
    if (!confHora) { toast.error("Informe a hora do crédito."); return; }
    if (confComp.data && confData < String(confComp.data).slice(0, 10)) { toast.error("O crédito não pode ser antes da data da compra."); return; }
    try {
      await confirmar.mutateAsync({ id: confComp.id, data: confData, hora: `${confHora.slice(0, 5)}:00` });
      toast.success("Crédito confirmado — as milhas entraram no estoque.");
      setConfComp(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao confirmar"); }
  };
  const handleDesfazer = async (c: any) => {
    if (!confirm(`Desfazer o crédito da compra ${c.id_compra ?? ""}? Ela volta a aguardar e sai do estoque.`)) return;
    try { await desfazer.mutateAsync(c.id); toast.success("Crédito desfeito — a compra voltou a aguardar."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao desfazer"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <h1 className="text-2xl font-display font-bold">Conferência Compras</h1><AjudaButton chave="estoque_conferencia_compras" />
      </div>
      <p className="text-sm text-muted-foreground">
        Toda compra lançada fica aqui até os pontos caírem na conta. Ao confirmar, informe a data e a hora do crédito: é nessa data que as milhas entram no estoque e no custo médio.
      </p>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b">
          <div className="text-sm font-medium">
            Aguardando crédito — {pendFiltradas.length} {pendFiltradas.length === 1 ? "compra" : "compras"} · {nf(totalPendente)} milhas
          </div>
          <SearchBar value={qPend} onChange={setQPend} placeholder="Pesquisar por código, conta, programa, operação..." />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Código" sortKey="id_compra" activeKey={kP} dir={dP} onSort={tP} />
              <SortableHead label="Data da compra" sortKey="_sData" activeKey={kP} dir={dP} onSort={tP} />
              <SortableHead label="Conta" sortKey="_sConta" activeKey={kP} dir={dP} onSort={tP} />
              <SortableHead label="Programa" sortKey="_estoque" activeKey={kP} dir={dP} onSort={tP} />
              <SortableHead label="Operação" sortKey="_sOperacao" activeKey={kP} dir={dP} onSort={tP} />
              <SortableHead label="Milhas" sortKey="_sQtde" activeKey={kP} dir={dP} onSort={tP} className="text-right" align="right" />
              <SortableHead label="Custo" sortKey="_sCusto" activeKey={kP} dir={dP} onSort={tP} className="text-right" align="right" />
              <SortableHead label="Aguardando" sortKey="_sDias" activeKey={kP} dir={dP} onSort={tP} className="text-right" align="right" />
              <TableHead className="w-[150px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : pendOrdenadas.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">{qPend ? "Nenhuma compra pendente com essa pesquisa" : "Nenhuma compra aguardando crédito"}</TableCell></TableRow>
            ) : pendOrdenadas.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="py-2 font-mono whitespace-nowrap">{c.id_compra || "—"}</TableCell>
                <TableCell className="py-2 whitespace-nowrap">{fmtData(c.data)} {fmtHora(c.hora)}</TableCell>
                <TableCell className="py-2 whitespace-nowrap" title={c.contas?.nome ?? ""}>{c.contas?.codigo ?? "—"}</TableCell>
                <TableCell className="py-2">{c._estoque || "—"}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.operacao || "—"}{c.descricao ? ` — ${c.descricao}` : ""}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{nf(c.qtde)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums whitespace-nowrap">{brl(c.custo_total)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums whitespace-nowrap">{c._sDias != null ? `${c._sDias} ${c._sDias === 1 ? "dia" : "dias"}` : "—"}</TableCell>
                <TableCell className="py-1 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar compra" onClick={() => navigate(`/estoque-compras/${c.id}/editar`)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" className="h-7" onClick={() => abrirConfirmar(c)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Confirmar</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b">
          <div className="text-sm font-medium">Creditadas — {credFiltradas.length} {credFiltradas.length === 1 ? "compra" : "compras"}</div>
          <SearchBar value={qCred} onChange={setQCred} placeholder="Pesquisar nas creditadas..." />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Código" sortKey="id_compra" activeKey={kC} dir={dC} onSort={tC} />
              <SortableHead label="Data da compra" sortKey="_sData" activeKey={kC} dir={dC} onSort={tC} />
              <SortableHead label="Crédito em" sortKey="_sCredito" activeKey={kC} dir={dC} onSort={tC} />
              <SortableHead label="Conta" sortKey="_sConta" activeKey={kC} dir={dC} onSort={tC} />
              <SortableHead label="Programa" sortKey="_estoque" activeKey={kC} dir={dC} onSort={tC} />
              <SortableHead label="Operação" sortKey="_sOperacao" activeKey={kC} dir={dC} onSort={tC} />
              <SortableHead label="Milhas" sortKey="_sQtde" activeKey={kC} dir={dC} onSort={tC} className="text-right" align="right" />
              <SortableHead label="Levou" sortKey="_sDias" activeKey={kC} dir={dC} onSort={tC} className="text-right" align="right" />
              <TableHead className="w-[60px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credOrdenadas.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma compra creditada por aqui ainda</TableCell></TableRow>
            ) : credOrdenadas.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="py-2 font-mono whitespace-nowrap">{c.id_compra || "—"}</TableCell>
                <TableCell className="py-2 whitespace-nowrap">{fmtData(c.data)} {fmtHora(c.hora)}</TableCell>
                <TableCell className="py-2 whitespace-nowrap">{fmtData(c.creditado_data)} {fmtHora(c.creditado_hora)}</TableCell>
                <TableCell className="py-2 whitespace-nowrap" title={c.contas?.nome ?? ""}>{c.contas?.codigo ?? "—"}</TableCell>
                <TableCell className="py-2">{c._estoque || "—"}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.operacao || "—"}{c.descricao ? ` — ${c.descricao}` : ""}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{nf(c.qtde)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums whitespace-nowrap">{c._sDias != null ? `${c._sDias} ${c._sDias === 1 ? "dia" : "dias"}` : "—"}</TableCell>
                <TableCell className="py-1 text-right">
                  {podeDesfazer && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Desfazer o crédito (volta a aguardar)" onClick={() => handleDesfazer(c)}>
                      <Undo2 className="h-4 w-4 text-amber-600" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!confComp} onOpenChange={(o) => { if (!o) setConfComp(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirmar crédito da compra {confComp?.id_compra ?? ""}</DialogTitle></DialogHeader>
          {confComp && (
            <div className="grid gap-3 py-2">
              <div className="text-sm text-muted-foreground">
                {confComp.contas?.codigo ?? ""} · {confComp.programas_estoque?.nome ?? ""} · <strong className="text-foreground">{nf(confComp.qtde)} milhas</strong> · {brl(confComp.custo_total)}
                <br />Comprada em {fmtData(confComp.data)} {fmtHora(confComp.hora)}{confComp.operacao ? ` · ${confComp.operacao}` : ""}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1"><Label>Data do crédito *</Label><Input type="date" value={confData} onChange={(e) => setConfData(e.target.value)} /></div>
                <div className="grid gap-1"><Label>Hora do crédito *</Label><Input type="time" value={confHora} onChange={(e) => setConfHora(e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">As milhas entram no estoque (saldo e custo médio) nesta data e hora — não na data da compra.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfComp(null)}>Cancelar</Button>
            <Button onClick={salvarConfirmacao} disabled={confirmar.isPending}>{confirmar.isPending ? "Confirmando..." : "Confirmar crédito"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
