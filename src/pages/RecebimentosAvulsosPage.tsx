import { useState, useMemo, Fragment, useEffect } from "react";
import { useBancos, useEmissoesEmAberto, useRecebimentosAvulsos, useCriarParcelas, useMarcarRecebido, useExcluirRecebimentoAvulso } from "@/hooks/useData";
import { usePodeExcluir } from "@/hooks/usePerfil";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumericInput } from "@/components/ui/numeric-input";
import { SearchSelect } from "@/components/ui/search-select";
import { SearchBar } from "@/components/ui/search-bar";
import { AjudaButton } from "@/components/AjudaButton";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Loader2, CheckCircle2, History, Plus, Trash2, CircleDollarSign } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

const fmtData = (d: string | null) => (d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—");
const fmtReais = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ParcelaForm {
  numero_parcela: number;
  total_parcelas: number;
  data_prevista: string;
  valor: number;
  banco: string;
}

export default function RecebimentosAvulsosPage() {
  const podeExcluir = usePodeExcluir();
  const { data: emissoesEmAberto, isLoading: carregandoEmissoes } = useEmissoesEmAberto();
  const { data: recebimentos, isLoading } = useRecebimentosAvulsos();
  const { data: bancos } = useBancos();
  const criarParcelas = useCriarParcelas();
  const marcarRecebido = useMarcarRecebido();
  const excluir = useExcluirRecebimentoAvulso();

  const [search, setSearch] = useState("");
  const [verRecebidos, setVerRecebidos] = useState(false);

  // ---- Lançar novo recebimento (gera N parcelas) ----
  const [lancarOpen, setLancarOpen] = useState(false);
  const [emissaoKey, setEmissaoKey] = useState(""); // `${tabela_origem}:${id}`
  const [numParcelas, setNumParcelas] = useState(1);
  const [primeiraData, setPrimeiraData] = useState(() => new Date().toISOString().slice(0, 10));
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([]);
  const [bancoLancamento, setBancoLancamento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const emissaoSelecionada = useMemo(
    () => (emissoesEmAberto ?? []).find((e) => `${e.tabela_origem}:${e.id}` === emissaoKey),
    [emissoesEmAberto, emissaoKey]
  );

  // Recalcula as N parcelas (datas a cada 30 dias, valores divididos igualmente — a última absorve o resto do arredondamento)
  // OBS: <input type="date"> dispara onChange com valor vazio/incompleto enquanto o usuário ainda está digitando
  // (ex.: "2026-07-" antes de terminar o dia). Sem essa validação, `new Date(...)` vira "Invalid Date" e
  // `.toISOString()` lança uma exceção não tratada, derrubando a tela inteira (tela branca).
  useEffect(() => {
    if (!emissaoSelecionada || numParcelas < 1) { setParcelas([]); return; }
    const primeiraDataObj = new Date(`${primeiraData}T00:00:00`);
    if (!primeiraData || isNaN(primeiraDataObj.getTime())) return; // aguarda o usuário terminar de digitar uma data válida
    const total = emissaoSelecionada.saldo_pendente;
    const base = Math.floor((total / numParcelas) * 100) / 100;
    const novas: ParcelaForm[] = Array.from({ length: numParcelas }, (_, i) => {
      const ultima = i === numParcelas - 1;
      const valor = ultima ? Math.round((total - base * (numParcelas - 1)) * 100) / 100 : base;
      return {
        numero_parcela: i + 1,
        total_parcelas: numParcelas,
        data_prevista: addDays(primeiraDataObj, i * 30).toISOString().slice(0, 10),
        valor,
        banco: bancoLancamento,
      };
    });
    setParcelas(novas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emissaoKey, numParcelas, primeiraData]);

  // O banco vale para a emissão inteira (a mesma leva de parcelas) — ao trocar, propaga para as parcelas já geradas.
  useEffect(() => {
    setParcelas((arr) => arr.map((x) => ({ ...x, banco: bancoLancamento })));
  }, [bancoLancamento]);

  const abrirLancamento = () => {
    setEmissaoKey(""); setNumParcelas(1); setPrimeiraData(new Date().toISOString().slice(0, 10));
    setParcelas([]); setBancoLancamento((bancos ?? [])[0]?.nome ?? ""); setObservacao(""); setLancarOpen(true);
  };

  const somaParcelas = parcelas.reduce((a, p) => a + (p.valor || 0), 0);

  const confirmarLancamento = async () => {
    if (!emissaoSelecionada) { toast.error("Selecione a emissão."); return; }
    if (parcelas.length === 0) { toast.error("Informe ao menos 1 parcela."); return; }
    if (parcelas.some((p) => !p.data_prevista || p.valor <= 0)) { toast.error("Preencha data e valor de todas as parcelas."); return; }
    if (!bancoLancamento) { toast.error("Selecione o banco de recebimento."); return; }
    setSalvando(true);
    try {
      const resultado = await criarParcelas.mutateAsync({
        tabela_origem: emissaoSelecionada.tabela_origem,
        emissao_id: emissaoSelecionada.id,
        parcelas,
        observacao,
      });
      toast.success(
        `${parcelas.length} parcela(s) lançada(s) para ${emissaoSelecionada.id_emissao}.` +
        (resultado?.pixCancelado ? " Pix da emissão cancelado automaticamente." : ""),
        { duration: resultado?.pixCancelado ? 6000 : 4000 }
      );
      setLancarOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao lançar recebimento");
    } finally {
      setSalvando(false);
    }
  };

  // ---- Marcar parcela como recebida ----
  const [recebOpen, setRecebOpen] = useState(false);
  const [recebAlvo, setRecebAlvo] = useState<any>(null);
  const [recebData, setRecebData] = useState(() => new Date().toISOString().slice(0, 10));
  const [recebBanco, setRecebBanco] = useState("");
  const [recebValor, setRecebValor] = useState(0);
  const [confirmandoReceb, setConfirmandoReceb] = useState(false);

  const abrirRecebimento = (p: any) => {
    setRecebAlvo(p);
    setRecebData(new Date().toISOString().slice(0, 10));
    setRecebBanco(p.banco || (bancos ?? [])[0]?.nome || "");
    setRecebValor(Number(p.valor) || 0);
    setRecebOpen(true);
  };

  const confirmarRecebimento = async () => {
    if (!recebAlvo) return;
    if (!recebBanco) { toast.error("Selecione o banco."); return; }
    setConfirmandoReceb(true);
    try {
      await marcarRecebido.mutateAsync({ id: recebAlvo.id, data_recebimento: recebData, banco: recebBanco, valor: recebValor });
      toast.success("Recebimento registrado!");
      setRecebOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar recebimento");
    } finally {
      setConfirmandoReceb(false);
    }
  };

  const excluirParcela = async (p: any) => {
    const msg = p.status === "recebido"
      ? "Esta parcela já está marcada como RECEBIDA. Excluir vai recalcular o valor recebido e o status da emissão. Confirma a exclusão?"
      : "Excluir esta parcela prevista?";
    if (!confirm(msg)) return;
    try {
      await excluir.mutateAsync(p.id);
      toast.success("Parcela excluída.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
  };

  // ---- Listagem ----
  const filtrados = useMemo(() => {
    let list = (recebimentos ?? []).filter((p) => (verRecebidos ? p.status === "recebido" : p.status === "previsto"));
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((p) =>
        [p.id_emissao, (p.clientes as any)?.codigo, (p.clientes as any)?.nome_fantasia, p.banco].some((c) =>
          String(c ?? "").toLowerCase().includes(s)
        )
      );
    }
    return list;
  }, [recebimentos, verRecebidos, search]);

  const grupos = useMemo(() => {
    const map = new Map<string, { id_emissao: string; cliente: string; itens: any[] }>();
    for (const p of filtrados) {
      const key = `${p.tabela_origem}:${p.emissao_id}`;
      if (!map.has(key)) map.set(key, { id_emissao: p.id_emissao || "—", cliente: (p.clientes as any)?.nome_fantasia || "—", itens: [] });
      map.get(key)!.itens.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.id_emissao.localeCompare(b.id_emissao, "pt-BR"));
  }, [filtrados]);

  const { page, setPage, totalPages, paged, total, from, to } = usePagination(grupos, 100);

  const totalPrevisto = (recebimentos ?? []).filter((p) => p.status === "previsto").reduce((a, p) => a + (Number(p.valor) || 0), 0);
  const qtdePrevisto = (recebimentos ?? []).filter((p) => p.status === "previsto").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Recebimentos Avulsos</h1>
          <AjudaButton chave="recebimentos_avulsos" />
        </div>
        {!verRecebidos && (
          <Button onClick={abrirLancamento}>
            <Plus className="h-4 w-4 mr-2" />Lançar recebimento
          </Button>
        )}
      </div>

      {!verRecebidos && (
        <div className="flex flex-wrap gap-3">
          <Card className="px-4 py-3"><div className="text-xs text-muted-foreground">Parcelas previstas</div><div className="text-xl font-bold">{qtdePrevisto}</div></Card>
          <Card className="px-4 py-3"><div className="text-xs text-muted-foreground">Total previsto a receber</div><div className="text-xl font-bold">{fmtReais(totalPrevisto)}</div></Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por emissão, cliente, banco..." />
        <Button variant={verRecebidos ? "default" : "outline"} size="sm" onClick={() => setVerRecebidos(!verRecebidos)}>
          <History className="h-4 w-4 mr-1" />{verRecebidos ? "Ver previstos" : "Ver recebidos"}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parcela</TableHead>
              <TableHead>{verRecebidos ? "Data Recebimento" : "Data Prevista"}</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : total === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{verRecebidos ? "Nenhum recebimento registrado." : "Nenhuma parcela prevista."}</TableCell></TableRow>
            ) : paged.map((g) => (
              <Fragment key={`${g.id_emissao}-${g.cliente}`}>
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={5} className="py-2 font-semibold">
                    <span className="font-mono">{g.id_emissao}</span> · {g.cliente}
                    <Badge variant="secondary" className="ml-2">{g.itens.length} parcela(s)</Badge>
                  </TableCell>
                </TableRow>
                {g.itens.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="py-2">{p.numero_parcela}/{p.total_parcelas}</TableCell>
                    <TableCell className="py-2">{fmtData(verRecebidos ? p.data_recebimento : p.data_prevista)}</TableCell>
                    <TableCell className="py-2 text-right font-mono">{fmtReais(Number(p.valor))}</TableCell>
                    <TableCell className="py-2 text-muted-foreground">{p.banco || "—"}</TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {!verRecebidos && (
                          <Button variant="ghost" size="icon" title="Marcar como recebido" onClick={() => abrirRecebimento(p)}>
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </Button>
                        )}
                        {podeExcluir && (
                          <Button variant="ghost" size="icon" title="Excluir parcela" onClick={() => excluirParcela(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
        <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
      </Card>

      {/* Dialog: lançar recebimento (gerar N parcelas) */}
      <Dialog open={lancarOpen} onOpenChange={setLancarOpen}>
        <DialogContent className="w-[95vw] max-w-3xl min-h-[min(70vh,520px)] max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5" />Lançar recebimento avulso</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <div className="grid gap-2">
              <Label className="text-base">Emissão em aberto *</Label>
              <SearchSelect
                value={emissaoKey}
                onChange={setEmissaoKey}
                placeholder={carregandoEmissoes ? "Carregando..." : "Busque por ID, cliente..."}
                optionsLarge
                listClassName="max-h-[min(50vh,400px)]"
                options={(emissoesEmAberto ?? []).map((e) => ({
                  value: `${e.tabela_origem}:${e.id}`,
                  label: `${e.id_emissao} — ${e.cliente_codigo} ${e.cliente_nome} — saldo ${fmtReais(e.saldo_pendente)}${e.tabela_origem === "emissoes_terceirizadas" ? " (terceirizada)" : ""}`,
                }))}
              />
              {!emissaoSelecionada && (
                <p className="text-xs text-muted-foreground">{(emissoesEmAberto ?? []).length} emissão(ões) em aberto disponível(is). Digite o ID, código ou nome do cliente para filtrar.</p>
              )}
            </div>

            {emissaoSelecionada && (
              <>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Preço total: </span>{fmtReais(emissaoSelecionada.preco_total)}</div>
                  <div><span className="text-muted-foreground">Já recebido: </span>{fmtReais(emissaoSelecionada.valor_recebido)}</div>
                  <div className="col-span-2 font-semibold"><span className="text-muted-foreground font-normal">Saldo em aberto: </span>{fmtReais(emissaoSelecionada.saldo_pendente)}</div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2"><Label>Nº de parcelas</Label><Input type="number" min={1} max={24} value={numParcelas} onChange={(e) => setNumParcelas(Math.max(1, parseInt(e.target.value) || 1))} /></div>
                  <div className="grid gap-2"><Label>Data da 1ª parcela</Label><Input type="date" value={primeiraData} onChange={(e) => setPrimeiraData(e.target.value)} /></div>
                  <div className="grid gap-2">
                    <Label>Banco de recebimento *</Label>
                    <SearchSelect
                      value={bancoLancamento}
                      onChange={setBancoLancamento}
                      placeholder="Selecione o banco..."
                      options={(bancos ?? []).map((b) => ({ value: b.nome, label: b.nome }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Parcelas (ajuste datas e valores se necessário)</Label>
                  <div className="rounded-lg border divide-y">
                    {parcelas.map((p, i) => (
                      <div key={i} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 px-3 py-2">
                        <span className="text-sm font-mono text-muted-foreground w-10">{p.numero_parcela}/{p.total_parcelas}</span>
                        <Input type="date" value={p.data_prevista} onChange={(e) => setParcelas((arr) => arr.map((x, idx) => idx === i ? { ...x, data_prevista: e.target.value } : x))} />
                        <NumericInput value={p.valor} onChange={(n) => setParcelas((arr) => arr.map((x, idx) => idx === i ? { ...x, valor: n } : x))} decimal prefix="R$" />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-right">Soma das parcelas: <b>{fmtReais(somaParcelas)}</b>{Math.abs(somaParcelas - emissaoSelecionada.saldo_pendente) > 0.01 && <span className="text-destructive"> — difere do saldo em aberto</span>}</p>
                </div>

                <div className="grid gap-2"><Label>Observação</Label><Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Opcional" /></div>
              </>
            )}
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setLancarOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarLancamento} disabled={salvando || !emissaoSelecionada}>{salvando ? "Salvando..." : "Lançar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: marcar parcela como recebida */}
      <Dialog open={recebOpen} onOpenChange={setRecebOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Registrar recebimento</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Parcela {recebAlvo?.numero_parcela}/{recebAlvo?.total_parcelas} de <b className="font-mono">{recebAlvo?.id_emissao}</b>. Confirme os dados do recebimento.
          </p>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="grid gap-1"><Label>Data do recebimento</Label><Input type="date" value={recebData} onChange={(e) => setRecebData(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Banco</Label><SearchSelect value={recebBanco} onChange={setRecebBanco} options={(bancos ?? []).map((b) => ({ value: b.nome, label: b.nome }))} /></div>
            <div className="col-span-2 grid gap-1"><Label>Valor recebido</Label><NumericInput value={recebValor} onChange={setRecebValor} decimal prefix="R$" /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setRecebOpen(false)} disabled={confirmandoReceb}>Cancelar</Button>
            <Button onClick={confirmarRecebimento} disabled={confirmandoReceb}>{confirmandoReceb ? "Salvando..." : "Confirmar recebimento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
