import { useState, useMemo, useEffect, Fragment } from "react";
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
import { PagarPorPixButton } from "@/components/PagarPorPixButton";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Loader2, CheckCircle2, History, Undo2, Lock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { contar } from "@/lib/plural";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";

const VALOR_FACIAL_PADRAO = 20;
// Máximo de pagamentos que o banco aceita num lote — "Marcar 20" seleciona exatamente essa quantidade.
const LIMITE_LOTE_BANCO = 20;

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

  // Emissoes presas num lote Pix aberto. Enquanto o lote nao se resolve, a emissao nao e de
  // ninguem: nao pode ir para outro Pix nem ser baixada na mao aqui. Por isso a linha perde a
  // caixa de selecao, em vez de deixar marcar e recusar la na frente.
  const { data: presas } = useQuery({
    queryKey: ["pagamento-facial", "em-lote-pix"],
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase.rpc("pagamentos_origens_em_lote_aberto", { p_tabela: "emissoes" });
      if (error) throw error;
      return new Map((data ?? []).map((r: any) => [r.origem_id as string, r.lote_status as string]));
    },
    refetchInterval: 15000,
  });
  const emLotePix = presas ?? new Map<string, string>();

  // Se um lote for montado em outra maquina com algo que estava marcado aqui, a marca cai.
  useEffect(() => {
    if (emLotePix.size === 0) return;
    setSel((s) => {
      const n = new Set(Array.from(s).filter((id) => !emLotePix.has(id)));
      return n.size === s.size ? s : n;
    });
  }, [presas]);

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

  // Ordenação das colunas: ordena as linhas ANTES de agrupar — as contas continuam por código e,
  // dentro de cada conta, as emissões seguem a coluna clicada. Seleção/totais usam `filtradas`.
  const filtradasSort = useMemo(() => filtradas.map((l: any) => ({ ...l, _sValor: Number(l.pagar_facial) || 0 })), [filtradas]);
  const { sorted: filtradasOrdenadas, key: sKey, dir: sDir, toggle: sToggle } = useSort<any>(filtradasSort, null);

  // agrupa por conta (código + nome), mantendo ordem por código
  const grupos = useMemo(() => {
    const map = new Map<string, { codigo: string; nome: string; itens: LinhaFacial[] }>();
    for (const l of filtradasOrdenadas as LinhaFacial[]) {
      const key = l.conta_id ?? l.conta_codigo;
      if (!map.has(key)) map.set(key, { codigo: l.conta_codigo, nome: l.conta_nome, itens: [] });
      map.get(key)!.itens.push(l);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })
    );
  }, [filtradasOrdenadas]);

  const { page, setPage, totalPages, paged, total, from, to } = usePagination(grupos, 100);

  const totalPendentes = (linhas ?? []).filter((l) => !l.pago).length;
  const valorPendente = totalPendentes * VALOR_FACIAL_PADRAO;

  // Marcar tudo de uma vez: pega a lista INTEIRA que o filtro esta mostrando, nao so a
  // pagina aberta — quem clica aqui quer "todas", e achar que marcou todas tendo marcado
  // 100 seria pior do que nao ter o botao.
  const idsDaLista = useMemo(
    () => filtradas.filter((l) => !emLotePix.has(l.id)).map((l) => l.id),
    [filtradas, presas],
  );
  const todosDaLista = idsDaLista.length > 0 && idsDaLista.every((id) => sel.has(id));
  const algunsDaLista = idsDaLista.some((id) => sel.has(id));
  const toggleTodos = () => setSel((s) => {
    const n = new Set(s);
    idsDaLista.forEach((id) => (todosDaLista ? n.delete(id) : n.add(id)));
    return n;
  });

  // "Marcar 20": substitui a seleção pelas primeiras 20 emissões disponíveis, na mesma ordem em
  // que aparecem na tela (contas por código e, dentro de cada conta, a ordenação escolhida).
  // Emissões em lote Pix aberto ficam de fora. Depois de pagar, as 20 saem da lista (ou ficam com
  // cadeado) e o próximo clique já pega as 20 seguintes.
  const idsProximos20 = useMemo(
    () => grupos.flatMap((g) => g.itens).filter((l) => !emLotePix.has(l.id)).slice(0, LIMITE_LOTE_BANCO).map((l) => l.id),
    [grupos, presas],
  );
  const marcados20 = idsProximos20.length > 0 && sel.size === idsProximos20.length && idsProximos20.every((id) => sel.has(id));
  const toggle20 = () => setSel(marcados20 ? new Set() : new Set(idsProximos20));

  const toggleUm = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleConta = (itens: LinhaFacial[]) => setSel((s) => {
    const n = new Set(s);
    const ids = itens.filter((i) => !emLotePix.has(i.id)).map((i) => i.id);
    if (ids.length === 0) return s;
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
      toast.success(`${contar(ids.length, "pagamento facial registrado", "pagamentos faciais registrados")}.`);
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
      toast.success(`${contar(ids.length, "pagamento facial revertido", "pagamentos faciais revertidos")}.`);
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
          <div className="flex items-center gap-2">
            <PagarPorPixButton tipo="facial" ids={[...sel]} valorUnitario={VALOR_FACIAL_PADRAO} />
            <Button onClick={abrirPagamento} disabled={sel.size === 0}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Pagar selecionados ({sel.size})
            </Button>
          </div>
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
        {!verPagos && (
          <label
            className="flex items-center gap-2 rounded-md border px-3 h-9 text-sm cursor-pointer select-none hover:bg-muted/50"
            title={`Marca as próximas ${LIMITE_LOTE_BANCO} emissões da lista — limite de pagamentos por lote permitido pelo banco`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(var(--primary))]"
              checked={marcados20}
              onChange={toggle20}
              disabled={idsProximos20.length === 0}
            />
            Marcar {LIMITE_LOTE_BANCO}
          </label>
        )}
        {!verPagos && sel.size > LIMITE_LOTE_BANCO && (
          <span className="text-xs text-destructive">{sel.size} selecionadas — o banco aceita no máximo {LIMITE_LOTE_BANCO} pagamentos por lote.</span>
        )}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={todosDaLista}
                  ref={(el) => { if (el) el.indeterminate = algunsDaLista && !todosDaLista; }}
                  onChange={toggleTodos}
                  disabled={idsDaLista.length === 0}
                  aria-label="Selecionar todas"
                  title={todosDaLista
                    ? "Desmarcar todas"
                    : `Selecionar as ${idsDaLista.length} ${idsDaLista.length === 1 ? "emissão" : "emissões"} da lista`}
                />
              </TableHead>
              <SortableHead label="Emissão" sortKey="id_emissao" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Data" sortKey="data_emissao" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Localizador" sortKey="localizador" activeKey={sKey} dir={sDir} onSort={sToggle} />
              <SortableHead label="Programa" sortKey="programa" activeKey={sKey} dir={sDir} onSort={sToggle} />
              {verPagos && <SortableHead label="Valor" sortKey="_sValor" activeKey={sKey} dir={sDir} onSort={sToggle} className="text-right" align="right" />}
              {verPagos && <SortableHead label="Pago em" sortKey="data_pagto_facial" activeKey={sKey} dir={sDir} onSort={sToggle} />}
              {verPagos && <SortableHead label="Banco de saída" sortKey="banco_pagamento_facial" activeKey={sKey} dir={sDir} onSort={sToggle} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={verPagos ? 8 : 5} className="text-center text-muted-foreground py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : total === 0 ? (
              <TableRow><TableCell colSpan={verPagos ? 8 : 5} className="text-center text-muted-foreground py-6">{verPagos ? "Nenhum facial pago." : "Nenhum facial pendente."}</TableCell></TableRow>
            ) : paged.map((g) => {
              const ids = g.itens.filter((i) => !emLotePix.has(i.id)).map((i) => i.id);
              const todos = ids.length > 0 && ids.every((id) => sel.has(id));
              const algum = ids.some((id) => sel.has(id));
              return (
                <Fragment key={`g-${g.codigo}`}>
                  <TableRow className="bg-muted/40">
                    <TableCell className="py-2">
                      <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={todos} disabled={ids.length === 0} ref={(el) => { if (el) el.indeterminate = algum && !todos; }} onChange={() => toggleConta(g.itens)} />
                    </TableCell>
                    <TableCell colSpan={verPagos ? 7 : 4} className="py-2 font-semibold">
                      <span className="font-mono">{g.codigo}</span> · {g.nome}
                      <Badge variant="secondary" className="ml-2">{contar(g.itens.length, "emissão", "emissões")}</Badge>
                    </TableCell>
                  </TableRow>
                  {g.itens.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="py-2 pl-6">
                        {emLotePix.has(l.id) ? (
                          <Lock
                            className="h-4 w-4 text-muted-foreground"
                            aria-label="Em lote de pagamento Pix"
                            title="Esta emissão está num lote de pagamento Pix aberto. Resolva o lote na Conferência Pix (aprove ou reverta) para ela voltar a ficar disponível."
                          />
                        ) : (
                          <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={sel.has(l.id)} onChange={() => toggleUm(l.id)} />
                        )}
                      </TableCell>
                      <TableCell className="py-2 font-mono text-sm">
                        {l.id_emissao || "—"}
                        {emLotePix.has(l.id) && (
                          <Badge variant="outline" className="ml-2 font-sans font-normal">
                            {emLotePix.get(l.id) === "APROVADO" || emLotePix.get(l.id) === "EXECUTANDO"
                              ? "pagando por Pix"
                              : "em conferência Pix"}
                          </Badge>
                        )}
                      </TableCell>
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
            {contar(sel.size, "emissão selecionada", "emissões selecionadas")}. Informe o valor por emissão, a data do pagamento e de qual banco saiu o valor. Cada emissão será marcada como paga.
          </p>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="grid gap-1"><Label>Valor por emissão (R$)</Label><NumericInput value={valor} onChange={setValor} decimal /></div>
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
            {contar(sel.size, "emissão volta", "emissões voltam")} para <b>pendentes</b>. A data e o banco do pagamento facial serão removidos. Deseja continuar?
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
