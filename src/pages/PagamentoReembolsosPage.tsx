import { useMemo, useState } from "react";
import { useReembolsosAPagar, useMarcarReembolsoPago, useBancos, useDesfazerPagamentoReembolso, useRemoverReembolsoDaFila } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchBar } from "@/components/ui/search-bar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/ui/search-select";
import { AjudaButton } from "@/components/AjudaButton";
import { HandCoins, CheckCircle2, Clock, Undo2, MinusCircle } from "lucide-react";
import { toast } from "sonner";

const fmtMoeda = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export default function PagamentoReembolsosPage() {
  const { data: reembolsos, isLoading } = useReembolsosAPagar();
  const { data: bancos } = useBancos();
  const marcar = useMarcarReembolsoPago();
  const desfazerMutation = useDesfazerPagamentoReembolso();
  const removerFila = useRemoverReembolsoDaFila();

  const [confirmDesfazer, setConfirmDesfazer] = useState<any>(null);
  const [confirmRemover, setConfirmRemover] = useState<any>(null);
  const [verPagos, setVerPagos] = useState(false);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dataPgto, setDataPgto] = useState(new Date().toISOString().split("T")[0]);
  const [banco, setBanco] = useState("");
  const [salvando, setSalvando] = useState(false);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (reembolsos ?? [])
      .filter((r) => !!r.pago === verPagos)
      .filter((r) => {
        if (!q) return true;
        const cli = r.clientes ? `${r.clientes.codigo} ${r.clientes.nome_fantasia}` : "";
        return [r.reembolso_id, r.localizador, r.id_emissao, cli].some((v) => String(v ?? "").toLowerCase().includes(q));
      });
  }, [reembolsos, verPagos, busca]);

  const totalPendente = useMemo(
    () => (reembolsos ?? []).filter((r) => !r.pago).reduce((s, r) => s + (Number(r.total_liquidacao) || 0), 0),
    [reembolsos]
  );

  const toggle = (id: string) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleTodos = () => {
    if (selecionados.size === lista.length) setSelecionados(new Set());
    else setSelecionados(new Set(lista.map((r) => r.id)));
  };

  const clienteLabel = (r: any) => (r.clientes ? `${r.clientes.codigo} - ${r.clientes.nome_fantasia}` : "—");

  const handleDesfazer = async (r: any) => {
    try {
      await desfazerMutation.mutateAsync(r.id);
      toast.success("Pagamento desfeito — o reembolso voltou para Pendentes.");
      setConfirmDesfazer(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao desfazer o pagamento.");
    }
  };

  const handleRemover = async (r: any) => {
    try {
      await removerFila.mutateAsync(r.id);
      toast.success("Removido da fila de pagamento. O reembolso continua salvo e pode ser editado.");
      setConfirmRemover(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover da fila.");
    }
  };

  const abrirPagamento = () => {
    if (selecionados.size === 0) { toast.error("Selecione ao menos um reembolso."); return; }
    setDataPgto(new Date().toISOString().split("T")[0]);
    setBanco("");
    setDialogOpen(true);
  };

  const confirmar = async () => {
    if (!banco) { toast.error("Selecione o banco de saída."); return; }
    setSalvando(true);
    try {
      await marcar.mutateAsync({ ids: Array.from(selecionados), data_pagamento: dataPgto, banco_pagamento: banco });
      toast.success("Reembolso(s) marcado(s) como pago(s).");
      setSelecionados(new Set());
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao marcar como pago.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <HandCoins className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Pagamento de Reembolsos</h1>
          <AjudaButton chave="pagamento_reembolsos" />
        </div>
        {!verPagos && selecionados.size > 0 && (
          <Button onClick={abrirPagamento}><CheckCircle2 className="h-4 w-4 mr-2" />Marcar como pago ({selecionados.size})</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Pendentes de pagamento</p>
          <p className="text-xl font-bold">{(reembolsos ?? []).filter((r) => !r.pago).length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total a reembolsar (pendente)</p>
          <p className="text-xl font-bold">{fmtMoeda(totalPendente)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por ID, localizador ou cliente..." />
        <div className="inline-flex rounded-md border overflow-hidden text-sm">
          <button type="button" onClick={() => { setVerPagos(false); setSelecionados(new Set()); }}
            className={`px-3 py-2 ${!verPagos ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}>Pendentes</button>
          <button type="button" onClick={() => { setVerPagos(true); setSelecionados(new Set()); }}
            className={`px-3 py-2 ${verPagos ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}>Pagos</button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {!verPagos && (
                  <TableHead className="w-10">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={lista.length > 0 && selecionados.size === lista.length} onChange={toggleTodos} />
                  </TableHead>
                )}
                <TableHead>Reembolso</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Localizador</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                {verPagos && <TableHead>Pago em</TableHead>}
                {verPagos && <TableHead>Banco</TableHead>}
                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((r) => (
                <TableRow key={r.id}>
                  {!verPagos && (
                    <TableCell className="py-2">
                      <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]"
                        checked={selecionados.has(r.id)} onChange={() => toggle(r.id)} />
                    </TableCell>
                  )}
                  <TableCell className="py-2 font-mono text-sm">{r.reembolso_id || "—"}</TableCell>
                  <TableCell className="py-2">{r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="py-2 font-medium">{r.localizador || "—"}</TableCell>
                  <TableCell className="py-2 text-sm">{clienteLabel(r)}</TableCell>
                  <TableCell className="py-2 text-right font-medium">{fmtMoeda(r.total_liquidacao)}</TableCell>
                  {verPagos && <TableCell className="py-2">{fmtData(r.data_pagamento)}</TableCell>}
                  {verPagos && <TableCell className="py-2 text-sm">{r.banco_pagamento || "—"}</TableCell>}
                  <TableCell className="py-2 text-right">
                    {verPagos ? (
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDesfazer(r)} title="Desfazer pagamento">
                        <Undo2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => setConfirmRemover(r)} title="Remover da fila de pagamento">
                        <MinusCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {lista.length === 0 && (
                <TableRow><TableCell colSpan={verPagos ? 8 : 7} className="text-center text-muted-foreground py-6">Nenhum reembolso {verPagos ? "pago" : "pendente"}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar {selecionados.size} reembolso(s) como pago(s)</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label>Data do pagamento</Label>
              <Input type="date" value={dataPgto} onChange={(e) => setDataPgto(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Banco de saída *</Label>
              <SearchSelect value={banco} onChange={setBanco} options={(bancos ?? []).map((b) => ({ value: b.nome, label: b.nome }))} placeholder="Selecione o banco" />
              {!banco && <p className="text-xs text-destructive">Obrigatório.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={salvando || !banco}>{salvando ? "Salvando..." : "Confirmar pagamento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDesfazer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDesfazer(null)}>
          <Card className="max-w-sm p-4 m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">Desfazer pagamento?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              O pagamento do reembolso <b className="font-mono">{confirmDesfazer.reembolso_id || ""}</b> será desfeito e ele voltará para <b>Pendentes</b>. O reembolso <b>não</b> é excluído. Tem certeza?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDesfazer(null)}>Cancelar</Button>
              <Button onClick={() => handleDesfazer(confirmDesfazer)} disabled={desfazerMutation.isPending}>
                {desfazerMutation.isPending ? "Desfazendo..." : "Desfazer pagamento"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {confirmRemover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmRemover(null)}>
          <Card className="max-w-sm p-4 m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">Remover da fila de pagamento?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              O reembolso <b className="font-mono">{confirmRemover.reembolso_id || ""}</b> sairá desta lista de pagamentos, mas <b>não</b> será excluído — ele continua salvo e pode ser editado depois. Para apagar o reembolso definitivamente, use a tela <b>Reembolsos</b>.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmRemover(null)}>Cancelar</Button>
              <Button onClick={() => handleRemover(confirmRemover)} disabled={removerFila.isPending}>
                {removerFila.isPending ? "Removendo..." : "Remover da fila"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
