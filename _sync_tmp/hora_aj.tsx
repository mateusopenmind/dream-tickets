import { useState, useMemo } from "react";
import { useEstoqueMovimentos, useAdicionarMovimento, useExcluirMovimento, useProgramasEstoque } from "@/hooks/useClubes";
import { useContas } from "@/hooks/useData";
import { SearchSelect } from "@/components/ui/search-select";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchBar } from "@/components/ui/search-bar";
import { useSearch } from "@/hooks/useSearch";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const nfSigned = (n: number) => `${n > 0 ? "+" : ""}${nf(n)}`;
const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const isoHoje = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const horaAgora = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
};
const emptyAjuste = { tipo: "saldo_inicial", sentido: "entrada", conta_id: "", programa_estoque_id: "", data: isoHoje(), hora: "", qtd: "", motivo: "" };

export default function AjusteEstoquePage() {
  const { data: movimentos, isLoading } = useEstoqueMovimentos();
  const { data: contas } = useContas();
  const { data: estoques } = useProgramasEstoque();
  const adicionar = useAdicionarMovimento();
  const excluir = useExcluirMovimento();
  const podeExcluir = usePodeExcluir();

  // Lista só de ajustes/saldo inicial
  const ajustes = useMemo(() => (movimentos ?? [])
    .filter((m: any) => m.tipo === "abertura" || m.tipo === "ajuste")
    .map((m: any) => ({
      ...m,
      _tipo: m.tipo === "abertura" ? "Saldo inicial" : "Ajuste",
      _conta: `${m.contas?.codigo ?? ""} ${m.contas?.nome ?? ""}`.trim(),
      _estoque: m.programas_estoque?.nome ?? "",
      _motivo: m.descricao ?? "",
    }))
    .sort((a: any, b: any) => (b.data ?? "").localeCompare(a.data ?? "")), [movimentos]);
  const { query, setQuery, filtered } = useSearch<any>(ajustes, ["_conta", "_estoque", "_motivo", "_tipo"]);

  const contasOrd = useMemo(() => (contas ?? []).slice().sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true })), [contas]);
  const contaOptions = useMemo(() => contasOrd.map((c: any) => ({ value: c.id, label: `${c.codigo ? c.codigo + " · " : ""}${c.nome}` })), [contasOrd]);

  const [open, setOpen] = useState(false);
  const [aj, setAj] = useState(emptyAjuste);
  const setAjField = (k: string, v: string) => setAj((a) => ({ ...a, [k]: v }));
  const openNew = () => { setAj({ ...emptyAjuste, data: isoHoje(), hora: horaAgora() }); setOpen(true); };

  const estoqueOptions = useMemo(
    () => (estoques ?? []).filter((e: any) => e.ativo !== false).map((e: any) => ({ value: e.id, label: e.nome })),
    [estoques]
  );

  const salvarAjuste = async () => {
    if (!aj.conta_id) { toast.error("Selecione a conta."); return; }
    if (!aj.programa_estoque_id) { toast.error("Selecione o estoque."); return; }
    if (!aj.data) { toast.error("Informe a data."); return; }
    if (aj.qtd === "" || Number.isNaN(Number(aj.qtd))) { toast.error("Informe a quantidade de milhas."); return; }
    if (!aj.motivo.trim()) { toast.error("Informe o motivo."); return; }
    const abs = Math.abs(Number(aj.qtd));
    const isInicial = aj.tipo === "saldo_inicial";
    // Saldo inicial é sempre entrada (+). Ajuste pode ser entrada (+) ou saída (−).
    const pontos = isInicial ? abs : (aj.sentido === "saida" ? -abs : abs);
    try {
      await adicionar.mutateAsync({
        conta_id: aj.conta_id, programa_estoque_id: aj.programa_estoque_id, data: aj.data, hora: aj.hora || null,
        tipo: isInicial ? "abertura" : "ajuste",
        pontos,
        descricao: aj.motivo.trim(),
        origem: isInicial ? "Saldo inicial" : (aj.sentido === "saida" ? "Ajuste (saída)" : "Ajuste (entrada)"),
      });
      toast.success("Ajuste de estoque lançado!");
      setOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao lançar ajuste"); }
  };
  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir este ajuste?")) return;
    try { await excluir.mutateAsync(id); toast.success("Ajuste removido."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao excluir"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Ajuste de estoque</h1><AjudaButton chave="estoque_ajuste" /></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo ajuste</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por conta, programa, motivo..." />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Conta</TableHead>
              <TableHead>Programa</TableHead><TableHead>Motivo</TableHead>
              <TableHead className="text-right">Qtd milhas</TableHead><TableHead className="w-[60px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum ajuste lançado</TableCell></TableRow>
            ) : filtered.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="py-2">{fmtData(m.data)}</TableCell>
                <TableCell className="py-2">{m._tipo}</TableCell>
                <TableCell className="py-2"><span className="font-mono text-xs text-muted-foreground">{m.contas?.codigo}</span> {m.contas?.nome}</TableCell>
                <TableCell className="py-2">{m.programas_estoque?.nome}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{m._motivo}</TableCell>
                <TableCell className={`py-2 text-right tabular-nums ${(Number(m.pontos) || 0) < 0 ? "text-destructive" : "text-emerald-600"}`}>{nfSigned(Number(m.pontos) || 0)}</TableCell>
                <TableCell className="py-2 text-right">
                  {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleExcluir(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo ajuste de estoque</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Tipo *</Label>
                <Select value={aj.tipo} onValueChange={(v) => setAjField("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saldo_inicial">Saldo inicial</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {aj.tipo === "ajuste" && (
                <div className="grid gap-1"><Label>Sentido *</Label>
                  <Select value={aj.sentido} onValueChange={(v) => setAjField("sentido", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada (+ soma)</SelectItem>
                      <SelectItem value="saida">Saída (− diminui)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Conta *</Label>
                <SearchSelect value={aj.conta_id} onChange={(v) => setAjField("conta_id", v)} options={contaOptions} placeholder="Selecione a conta" emptyText="Nenhuma conta" />
              </div>
              <div className="grid gap-1"><Label>Programa *</Label>
                <Select value={aj.programa_estoque_id} onValueChange={(v) => setAjField("programa_estoque_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o programa" /></SelectTrigger>
                  <SelectContent>
                    {estoqueOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum programa cadastrado</div>
                    ) : estoqueOptions.map((p: any) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-1"><Label>Data *</Label><Input type="date" value={aj.data} onChange={(e) => setAjField("data", e.target.value)} /></div>
              <div className="grid gap-1"><Label>Hora</Label><Input type="time" value={aj.hora} onChange={(e) => setAjField("hora", e.target.value)} /></div>
              <div className="grid gap-1"><Label>Qtd de milhas *</Label><Input type="number" min={0} value={aj.qtd} onChange={(e) => setAjField("qtd", e.target.value)} placeholder="10000" /></div>
            </div>
            <div className="grid gap-1"><Label>Motivo *</Label><Input value={aj.motivo} onChange={(e) => setAjField("motivo", e.target.value)} placeholder="Ex.: saldo inicial da migração / correção de divergência" /></div>
            <p className="text-xs text-muted-foreground">O lançamento entra já confirmado e aparece no Acompanhamento do estoque da conta/programa.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvarAjuste} disabled={adicionar.isPending}>{adicionar.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
