import { useState, useMemo, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBancos } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { SearchSelect } from "@/components/ui/search-select";
import { SearchBar } from "@/components/ui/search-bar";
import { AjudaButton } from "@/components/AjudaButton";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Loader2, CheckCircle2, History, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const VALOR_FACIAL_PADRAO = 20;

interface LinhaFacial {
  id: string;
  id_emissao: string | null;
  data_emissao: string | null;
  localizador: string | null;
  programa: string | null;
  conta_id: string | null;
  conta_codigo: string;
  conta_nome: string;
  pago: boolean;
  pagar_facial: number | null;
  data_pagto_facial: string | null;
  banco_pagamento_facial: string | null;
}

export default function PagamentoFacialPage() {
  const qc = useQueryClient();
  const { data: bancos } = useBancos();
  const [search, setSearch] = useState("");
  const [verPagos, setVerPagos] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pagando, setPagando] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reverter, setReverter] = useState(false);
  const [revertendo, setRevertendo] = useState(false);
  const [valor, setValor] = useState(VALOR_FACIAL_PADRAO);
  const [dataPgto, setDataPgto] = useState(() => new Date().toISOString().slice(0, 10));
  const [banco, setBanco] = useState("Sicredi");

  const { data: linhas, isLoading } = useQuery({
    queryKey: ["pagamento-facial"],
    queryFn: async (): Promise<LinhaFacial[]> => {
      const { data, error } = await supabase
        .from("emissoes")
        .select("id, id_emissao, data_emissao, localizador, programa, facial_pago, pagar_facial, data_pagto_facial, banco_pagamento_facial, conta_id, contas(codigo, nome)")
        .eq("facial", true)
        .order("data_emissao", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        id: e.id,
        id_emissao: e.id_emissao,
        data_emissao: e.data_emissao,
        localizador: e.localizador,
        programa: e.programa,
        conta_id: e.conta_id,
        conta_codigo: (e.contas as any)?.codigo ?? "—",
        conta_nome: (e.contas as any)?.nome ?? "—",
        pago: !!e.facial_pago,
        pagar_facial: e.pagar_facial,
        data_pagto_facial: e.data_pagto_facial,
        banco_pagamento_facial: e.banco_pagamento_facial,
      }));
    },
  });

  // filtra por status (pendentes/pagos) e busca
  const filtradas = useMemo(() => {
    let list = (linhas ?? []).filter((l) => (verPagos ? l.pago : !l.pago));
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((l) =>
        [l.id_emissao, l.localizador, l.programa, l.conta_codigo, l.conta_nome].some((c) =>
          String(c ?? "").toLowerCase().includes(s)
        )
      );
    }
    return list;
  }, [linhas, verPagos, search]);

  // agrupa por conta (código + nome), mantendo ordem por código
  const grupos = useMemo(() => {
    const map = new Map<string, { codigo: string; nome: string; itens: LinhaFacial[] }>();
    for (const l of filtradas) {
      const key = l.conta_id ?? l.conta_codigo;
      if (!map.has(key)) map.set(key, { codigo: l.conta_codigo, nome: l.conta_nome, itens: [] });
      map.get(key)!.itens.push(l);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })
    );
  }, [filtradas]);

  const { page, setPage, totalPages, paged, total, from, to } = usePagination(grupos, 100);

  const totalPendentes = (linhas ?? []).filter((l) => !l.pago).length;
  const valorPendente = totalPendentes * VALOR_FACIAL_PADRAO;

  const toggleUm = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleConta = (itens: LinhaFacial[]) => setSel((s) => {
    const n = new Set(s);
    const ids = itens.map((i) => i.id);
    const todosMarcados = ids.every((id) => n.has(id));
    ids.forEach((id) => (todosMarcados ? n.delete(id) : n.add(id)));
    return n;
  });

  const abrirPagamento = () => {
    if (sel.size === 0) { toast.error("Selecione ao menos uma emissão."); return; }
    setValor(VALOR_FACIAL_PADRAO);
    setDataPgto(new Date().toISOString().slice(0, 10));
    setBanco("Sicredi");
    setConfirm(true);
  };

  const confirmarPagamento = async () => {
    setPagando(true);
    try {
      const ids = Array.from(sel);
      const { error } = await supabase
        .from("emissoes")
        .update({ facial_pago: true, pagar_facial: Math.round(valor), data_pagto_facial: dataPgto, banco_pagamento_facial: banco })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} pagamento(s) facial registrado(s).`);
      setSel(new Set());
      setConfirm(false);
      qc.invalidateQueries({ queryKey: ["pagamento-facial"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar pagamento");
    } finally {
      setPagando(false);
    }
  };

  const abrirReverter = () => {
    if (sel.size === 0) { toast.error("Selecione ao menos um pagamento para reverter."); return; }
    setReverter(true);
  };

  const confirmarReverter = async () => {
    setRevertendo(true);
    try {
      const ids = Array.from(sel);
      const { error } = await supabase
        .from("emissoes")
        .update({ facial_pago: false, data_pagto_facial: null, banco_pagamento_facial: null })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} pagamento(s) facial revertido(s).`);
      setSel(new Set());
      setReverter(false);
      qc.invalidateQueries({ queryKey: ["pagamento-facial"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reverter pagamento");
    } finally {
      setRevertendo(false);
    }
  };

  const fmtData = (d: string | null) => (d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—");
  const fmtReais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  // pagar_facial é texto: emissões antigas guardam "Sim" (sem valor); as pagas pelo app guardam o valor. Sempre exibe em R$ (padrão quando não numérico).
  const fmtValorFacial = (v: string | number | null) => {
    const n = Number(v);
    return fmtReais(Number.isFinite(n) && n > 0 ? n : VALOR_FACIAL_PADRAO);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Pagamento Facial</h1>
          <AjudaButton chave="pagamento_facial" />
        </div>
        {!verPagos ? (
          <Button onClick={abrirPagamento} disabled={sel.size === 0}>
            <CheckCircle2 className="h-4 w-4 mr-2" />Pagar selecionados ({sel.size})
          </Button>
        ) : (
          <Button variant="destructive" onClick={abrirReverter} disabled={sel.size === 0}>
            <Undo2 className="h-4 w-4 mr-2" />Reverter pagamento ({sel.size})
          </Button>
        )}
      </div>

      {!verPagos && (
        <div className="flex flex-wrap gap-3">
          <Card className="px-4 py-3"><div className="text-xs text-muted-foreground">Emissões pendentes</div><div className="text-xl font-bold">{totalPendentes}</div></Card>
          <Card className="px-4 py-3"><div className="text-xs text-muted-foreground">Total a pagar (R$ {VALOR_FACIAL_PADRAO}/emissão)</div><div className="text-xl font-bold">{fmtReais(valorPendente)}</div></Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por emissão, conta, programa..." />
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
              {verPagos && <TableHead className="text-right">Valor</TableHead>}
              {verPagos && <TableHead>Pago em</TableHead>}
              {verPagos && <TableHead>Banco de saída</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={verPagos ? 8 : 5} className="text-center text-muted-foreground py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : total === 0 ? (
              <TableRow><TableCell colSpan={verPagos ? 8 : 5} className="text-center text-muted-foreground py-6">{verPagos ? "Nenhum facial pago." : "Nenhum facial pendente."}</TableCell></TableRow>
            ) : paged.map((g) => {
              const ids = g.itens.map((i) => i.id);
              const todos = ids.every((id) => sel.has(id));
              const algum = ids.some((id) => sel.has(id));
              return (
                <Fragment key={`g-${g.codigo}`}>
                  <TableRow className="bg-muted/40">
                    <TableCell className="py-2">
                      <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={todos} ref={(el) => { if (el) el.indeterminate = algum && !todos; }} onChange={() => toggleConta(g.itens)} />
                    </TableCell>
                    <TableCell colSpan={verPagos ? 7 : 4} className="py-2 font-semibold">
                      <span className="font-mono">{g.codigo}</span> · {g.nome}
                      <Badge variant="secondary" className="ml-2">{g.itens.length} emissão(ões)</Badge>
                    </TableCell>
                  </TableRow>
                  {g.itens.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="py-2 pl-6">
                        <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={sel.has(l.id)} onChange={() => toggleUm(l.id)} />
                      </TableCell>
                      <TableCell className="py-2 font-mono text-sm">{l.id_emissao || "—"}</TableCell>
                      <TableCell className="py-2">{fmtData(l.data_emissao)}</TableCell>
                      <TableCell className="py-2 font-mono text-sm font-semibold">{l.localizador || "—"}</TableCell>
                      <TableCell className="py-2 text-muted-foreground">{l.programa || "—"}</TableCell>
                      {verPagos && <TableCell className="py-2 text-right font-mono">{fmtValorFacial(l.pagar_facial)}</TableCell>}
                      {verPagos && <TableCell className="py-2 text-muted-foreground">{fmtData(l.data_pagto_facial)}</TableCell>}
                      {verPagos && <TableCell className="py-2 text-muted-foreground">{l.banco_pagamento_facial || "—"}</TableCell>}
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
          <DialogHeader><DialogTitle>Registrar pagamento facial</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {sel.size} emissão(ões) selecionada(s). Informe o valor por emissão, a data do pagamento e de qual banco saiu o valor. Cada emissão será marcada como paga.
          </p>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="grid gap-1"><Label>Valor por emissão (R$)</Label><NumericInput value={valor} onChange={setValor} decimal placeholder="20,00" /></div>
            <div className="grid gap-1"><Label>Data do pagamento</Label><Input type="date" value={dataPgto} onChange={(e) => setDataPgto(e.target.value)} /></div>
            <div className="grid gap-1 col-span-2"><Label>Banco de saída</Label><SearchSelect value={banco} onChange={setBanco} options={(bancos ?? []).map((b) => ({ value: b.nome, label: b.nome }))} /></div>
          </div>
          <div className="text-sm">Total: <b>{fmtReais(sel.size * (valor || 0))}</b></div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={pagando}>Cancelar</Button>
            <Button onClick={confirmarPagamento} disabled={pagando}>{pagando ? "Salvando..." : `Confirmar pagamento`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reverter} onOpenChange={(o) => { if (!o) setReverter(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reverter pagamento facial</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {sel.size} emissão(ões) voltarão para <b>pendentes</b>. A data e o banco do pagamento facial serão removidos. Deseja continuar?
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setReverter(false)} disabled={revertendo}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarReverter} disabled={revertendo}>{revertendo ? "Revertendo..." : "Reverter pagamento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
