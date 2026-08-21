import { useState, useMemo, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBancos } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { SearchBar } from "@/components/ui/search-bar";
import { AjudaButton } from "@/components/AjudaButton";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Loader2, CheckCircle2, History, Copy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface LinhaFornecedor {
  id: string;
  id_emissao: string | null;
  data_emissao: string | null;
  localizador: string | null;
  programa: string | null;
  fornecedor_id: string | null;
  fornecedor_codigo: string;
  fornecedor_nome: string;
  fornecedor_chave_pix: string | null;
  custo_total: number | null;
  pago: boolean;
  data_pagamento_fornecedor: string | null;
  banco_pagamento_fornecedor: string | null;
}

export default function PagamentoFornecedoresPage() {
  const qc = useQueryClient();
  const { data: bancos } = useBancos();
  const [search, setSearch] = useState("");
  const [verPagos, setVerPagos] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pagando, setPagando] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [dataPgto, setDataPgto] = useState(() => new Date().toISOString().slice(0, 10));
  const [banco, setBanco] = useState("Sicredi");

  const { data: linhas, isLoading } = useQuery({
    queryKey: ["pagamento-fornecedores"],
    queryFn: async (): Promise<LinhaFornecedor[]> => {
      const { data, error } = await supabase
        .from("emissoes_terceirizadas")
        .select("id, id_emissao, data_emissao, localizador, programa, custo_total, fornecedor_pago, data_pagamento_fornecedor, banco_pagamento_fornecedor, fornecedor_id, fornecedores(codigo, nome, chave_pix)")
        .order("data_emissao", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        id: e.id,
        id_emissao: e.id_emissao,
        data_emissao: e.data_emissao,
        localizador: e.localizador,
        programa: e.programa,
        fornecedor_id: e.fornecedor_id,
        fornecedor_codigo: (e.fornecedores as any)?.codigo ?? "—",
        fornecedor_nome: (e.fornecedores as any)?.nome ?? "—",
        fornecedor_chave_pix: (e.fornecedores as any)?.chave_pix ?? null,
        custo_total: e.custo_total,
        pago: !!e.fornecedor_pago,
        data_pagamento_fornecedor: e.data_pagamento_fornecedor,
        banco_pagamento_fornecedor: e.banco_pagamento_fornecedor,
      }));
    },
  });

  const filtradas = useMemo(() => {
    let list = (linhas ?? []).filter((l) => (verPagos ? l.pago : !l.pago));
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((l) =>
        [l.id_emissao, l.localizador, l.programa, l.fornecedor_codigo, l.fornecedor_nome].some((c) =>
          String(c ?? "").toLowerCase().includes(s)
        )
      );
    }
    return list;
  }, [linhas, verPagos, search]);

  // agrupa por fornecedor
  const grupos = useMemo(() => {
    const map = new Map<string, { codigo: string; nome: string; chave_pix: string | null; itens: LinhaFornecedor[] }>();
    for (const l of filtradas) {
      const key = l.fornecedor_id ?? l.fornecedor_codigo;
      if (!map.has(key)) map.set(key, { codigo: l.fornecedor_codigo, nome: l.fornecedor_nome, chave_pix: l.fornecedor_chave_pix, itens: [] });
      map.get(key)!.itens.push(l);
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [filtradas]);

  const { page, setPage, totalPages, paged, total, from, to } = usePagination(grupos, 100);

  const totalPendentes = (linhas ?? []).filter((l) => !l.pago).length;
  const valorPendente = (linhas ?? []).filter((l) => !l.pago).reduce((a, l) => a + (l.custo_total || 0), 0);

  const toggleUm = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleFornecedor = (itens: LinhaFornecedor[]) => setSel((s) => {
    const n = new Set(s);
    const ids = itens.map((i) => i.id);
    const todosMarcados = ids.every((id) => n.has(id));
    ids.forEach((id) => (todosMarcados ? n.delete(id) : n.add(id)));
    return n;
  });

  const selecionadas = (linhas ?? []).filter((l) => sel.has(l.id));
  const valorSelecionado = selecionadas.reduce((a, l) => a + (l.custo_total || 0), 0);
  // Só permite confirmar pagamento em lote quando todas as selecionadas são do mesmo fornecedor (chave Pix única).
  const fornecedoresSelecionados = new Set(selecionadas.map((l) => l.fornecedor_id));

  const abrirPagamento = () => {
    if (sel.size === 0) { toast.error("Selecione ao menos uma emissão."); return; }
    if (fornecedoresSelecionados.size > 1) { toast.error("Selecione emissões de um único fornecedor por vez (chave Pix diferente)."); return; }
    setDataPgto(new Date().toISOString().slice(0, 10));
    setBanco("Sicredi");
    setConfirm(true);
  };

  const confirmarPagamento = async () => {
    setPagando(true);
    try {
      const ids = Array.from(sel);
      const { error } = await supabase
        .from("emissoes_terceirizadas")
        .update({ fornecedor_pago: true, data_pagamento_fornecedor: dataPgto, banco_pagamento_fornecedor: banco })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} pagamento(s) a fornecedor registrado(s).`);
      setSel(new Set());
      setConfirm(false);
      qc.invalidateQueries({ queryKey: ["pagamento-fornecedores"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar pagamento");
    } finally {
      setPagando(false);
    }
  };

  const copiarChavePix = (chave: string | null) => {
    if (!chave) { toast.error("Este fornecedor não tem chave Pix cadastrada."); return; }
    navigator.clipboard?.writeText(chave);
    toast.success("Chave Pix copiada!");
  };

  const fmtData = (d: string | null) => (d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—");
  const fmtReais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Pagamento Fornecedores</h1>
          <AjudaButton chave="pagamento_fornecedores" />
        </div>
        {!verPagos && (
          <Button onClick={abrirPagamento} disabled={sel.size === 0}>
            <CheckCircle2 className="h-4 w-4 mr-2" />Pagar selecionados ({sel.size})
          </Button>
        )}
      </div>

      {!verPagos && (
        <div className="flex flex-wrap gap-3">
          <Card className="px-4 py-3"><div className="text-xs text-muted-foreground">Emissões pendentes</div><div className="text-xl font-bold">{totalPendentes}</div></Card>
          <Card className="px-4 py-3"><div className="text-xs text-muted-foreground">Total a pagar aos fornecedores</div><div className="text-xl font-bold">{fmtReais(valorPendente)}</div></Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por emissão, fornecedor, programa..." />
        <Button variant={verPagos ? "default" : "outline"} size="sm" onClick={() => { setVerPagos(!verPagos); setSel(new Set()); }}>
          <History className="h-4 w-4 mr-1" />{verPagos ? "Ver pendentes" : "Ver pagos"}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Localizador</TableHead>
              <TableHead>Programa</TableHead>
              <TableHead className="text-right">Custo Total</TableHead>
              {verPagos && <TableHead>Pago em</TableHead>}
              {verPagos && <TableHead>Banco de saída</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={verPagos ? 8 : 6} className="text-center text-muted-foreground py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : total === 0 ? (
              <TableRow><TableCell colSpan={verPagos ? 8 : 6} className="text-center text-muted-foreground py-6">{verPagos ? "Nenhum pagamento a fornecedor registrado." : "Nenhum pagamento a fornecedor pendente."}</TableCell></TableRow>
            ) : paged.map((g) => {
              const ids = g.itens.map((i) => i.id);
              const todos = ids.every((id) => sel.has(id));
              const algum = ids.some((id) => sel.has(id));
              return (
                <Fragment key={`g-${g.codigo}-${g.nome}`}>
                  <TableRow className="bg-muted/40">
                    <TableCell className="py-2">
                      {!verPagos && (
                        <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={todos} ref={(el) => { if (el) el.indeterminate = algum && !todos; }} onChange={() => toggleFornecedor(g.itens)} />
                      )}
                    </TableCell>
                    <TableCell colSpan={verPagos ? 7 : 5} className="py-2 font-semibold">
                      <span className="font-mono">{g.codigo}</span> · {g.nome}
                      <Badge variant="secondary" className="ml-2">{g.itens.length} emissão(ões)</Badge>
                      {g.chave_pix && (
                        <Button type="button" variant="ghost" size="sm" className="ml-2 h-6 px-2" onClick={() => copiarChavePix(g.chave_pix)}>
                          <Copy className="h-3 w-3 mr-1" />Chave Pix
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {g.itens.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="py-2 pl-6">
                        {!verPagos && (
                          <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={sel.has(l.id)} onChange={() => toggleUm(l.id)} />
                        )}
                      </TableCell>
                      <TableCell className="py-2 font-mono text-sm">{l.id_emissao || "—"}</TableCell>
                      <TableCell className="py-2">{fmtData(l.data_emissao)}</TableCell>
                      <TableCell className="py-2 font-mono text-sm font-semibold">{l.localizador || "—"}</TableCell>
                      <TableCell className="py-2 text-muted-foreground">{l.programa || "—"}</TableCell>
                      <TableCell className="py-2 text-right font-mono">{l.custo_total != null ? fmtReais(l.custo_total) : "—"}</TableCell>
                      {verPagos && <TableCell className="py-2 text-muted-foreground">{fmtData(l.data_pagamento_fornecedor)}</TableCell>}
                      {verPagos && <TableCell className="py-2 text-muted-foreground">{l.banco_pagamento_fornecedor || "—"}</TableCell>}
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
      </Card>

      <Dialog open={confirm} onOpenChange={(o) => { if (!o) setConfirm(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Registrar pagamento a fornecedor</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {sel.size} emissão(ões) selecionada(s), total <b>{fmtReais(valorSelecionado)}</b>. Informe de qual banco saiu o Pix e a data do pagamento.
          </p>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="grid gap-1"><Label>Banco de saída</Label><SearchSelect value={banco} onChange={setBanco} options={(bancos ?? []).map((b) => ({ value: b.nome, label: b.nome }))} /></div>
            <div className="grid gap-1"><Label>Data do pagamento</Label><Input type="date" value={dataPgto} onChange={(e) => setDataPgto(e.target.value)} /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={pagando}>Cancelar</Button>
            <Button onClick={confirmarPagamento} disabled={pagando}>{pagando ? "Salvando..." : `Confirmar pagamento`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
