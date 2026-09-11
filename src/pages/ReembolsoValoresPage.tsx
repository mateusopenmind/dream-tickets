import { useMemo, useState } from "react";
import { useReembolsos, useMarcarReembolsoStatus, useDesfazerReembolsoStatus } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchBar } from "@/components/ui/search-bar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AjudaButton } from "@/components/AjudaButton";
import { CreditCard, CheckCircle2, Undo2, Clock } from "lucide-react";
import { toast } from "sonner";

const fmtMoeda = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const fmtDataHora = (s?: string | null) =>
  s ? `${new Date(s).toLocaleDateString("pt-BR")} ${new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—";

// Valor que volta para o cartão = Taxas + Bagagens + Assentos + Outros (lado Dream Tickets).
const totalCartao = (r: any) =>
  (Number(r.dt_taxas) || 0) + (Number(r.dt_bagagens) || 0) + (Number(r.dt_assentos) || 0) + (Number(r.dt_outros) || 0);

export default function ReembolsoValoresPage() {
  const { data: reembolsos, isLoading } = useReembolsos();
  const marcar = useMarcarReembolsoStatus();
  const desfazer = useDesfazerReembolsoStatus();

  const [verReembolsados, setVerReembolsados] = useState(false);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dataReemb, setDataReemb] = useState(new Date().toISOString().split("T")[0]);
  const [salvando, setSalvando] = useState(false);
  const [confirmDesfazer, setConfirmDesfazer] = useState<any>(null);

  const comValores = useMemo(() => (reembolsos ?? []).filter((r) => totalCartao(r) > 0), [reembolsos]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return comValores
      .filter((r) => !!r.cartao_reembolsado === verReembolsados)
      .filter((r) => {
        if (!q) return true;
        return [r.reembolso_id, r.localizador, r.id_emissao, r.cartao].some((v) => String(v ?? "").toLowerCase().includes(q));
      });
  }, [comValores, verReembolsados, busca]);

  const totalPendente = useMemo(
    () => comValores.filter((r) => !r.cartao_reembolsado).reduce((s, r) => s + totalCartao(r), 0),
    [comValores]
  );
  const qtdPendente = useMemo(() => comValores.filter((r) => !r.cartao_reembolsado).length, [comValores]);

  const clienteLabel = (r: any) => (r.clientes ? `${r.clientes.codigo} - ${r.clientes.nome_fantasia}` : "—");

  const toggle = (id: string) => setSelecionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTodos = () => { if (selecionados.size === lista.length) setSelecionados(new Set()); else setSelecionados(new Set(lista.map((r) => r.id))); };

  const abrir = () => { if (selecionados.size === 0) { toast.error("Selecione ao menos um."); return; } setDataReemb(new Date().toISOString().split("T")[0]); setDialogOpen(true); };
  const confirmar = async () => {
    setSalvando(true);
    try {
      await marcar.mutateAsync({ ids: Array.from(selecionados), campo: "cartao_reembolsado", dataField: "cartao_reembolsado_em", data: dataReemb });
      toast.success("Marcado(s) como reembolsado(s) no cartão.");
      setSelecionados(new Set());
      setDialogOpen(false);
    } catch (e: any) { toast.error(e?.message || "Erro ao marcar."); } finally { setSalvando(false); }
  };
  const handleDesfazer = async (r: any) => {
    try {
      await desfazer.mutateAsync({ id: r.id, campo: "cartao_reembolsado", dataField: "cartao_reembolsado_em" });
      toast.success("Reembolso do cartão desfeito — voltou para Pendentes.");
      setConfirmDesfazer(null);
    } catch (e: any) { toast.error(e?.message || "Erro ao desfazer."); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Reembolso Valores</h1>
          <AjudaButton chave="reembolso_valores" />
        </div>
        {!verReembolsados && selecionados.size > 0 && (
          <Button onClick={abrir}><CheckCircle2 className="h-4 w-4 mr-2" />Marcar como reembolsado ({selecionados.size})</Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Valores que voltam para o cartão de crédito usado na emissão (Taxas + Bagagens + Assentos + Outros do lado Dream Tickets). As milhas não entram aqui.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Pendentes de reembolso</p>
          <p className="text-xl font-bold">{qtdPendente}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total a devolver no cartão (pendente)</p>
          <p className="text-xl font-bold">{fmtMoeda(totalPendente)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por ID, localizador, emissão ou cartão..." />
        <div className="inline-flex rounded-md border overflow-hidden text-sm">
          <button type="button" onClick={() => { setVerReembolsados(false); setSelecionados(new Set()); }}
            className={`px-3 py-2 ${!verReembolsados ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}>Pendentes</button>
          <button type="button" onClick={() => { setVerReembolsados(true); setSelecionados(new Set()); }}
            className={`px-3 py-2 ${verReembolsados ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}>Reembolsados</button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!verReembolsados && (
                  <TableHead className="w-10"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={lista.length > 0 && selecionados.size === lista.length} onChange={toggleTodos} /></TableHead>
                )}
                <TableHead>Reembolso</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Localizador</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cartão</TableHead>
                <TableHead className="text-right">Taxas</TableHead>
                <TableHead className="text-right">Bagagens</TableHead>
                <TableHead className="text-right">Assentos</TableHead>
                <TableHead className="text-right">Outros</TableHead>
                <TableHead className="text-right">Total Cartão</TableHead>
                {verReembolsados && <TableHead>Reembolsado em</TableHead>}
                {verReembolsados && <TableHead className="w-16 text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((r: any) => (
                <TableRow key={r.id}>
                  {!verReembolsados && (
                    <TableCell className="py-2"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={selecionados.has(r.id)} onChange={() => toggle(r.id)} /></TableCell>
                  )}
                  <TableCell className="py-2 font-mono text-sm whitespace-nowrap">{r.reembolso_id || "—"}</TableCell>
                  <TableCell className="py-2 whitespace-nowrap text-sm">{fmtDataHora(r.created_at)}</TableCell>
                  <TableCell className="py-2 font-mono text-sm font-semibold">{r.localizador || "—"}</TableCell>
                  <TableCell className="py-2 font-mono text-sm">{r.id_emissao || "—"}</TableCell>
                  <TableCell className="py-2 text-sm">{clienteLabel(r)}</TableCell>
                  <TableCell className="py-2 text-sm">{r.cartao || "—"}</TableCell>
                  <TableCell className="py-2 text-right">{fmtMoeda(r.dt_taxas)}</TableCell>
                  <TableCell className="py-2 text-right">{fmtMoeda(r.dt_bagagens)}</TableCell>
                  <TableCell className="py-2 text-right">{fmtMoeda(r.dt_assentos)}</TableCell>
                  <TableCell className="py-2 text-right">{fmtMoeda(r.dt_outros)}</TableCell>
                  <TableCell className="py-2 text-right font-semibold">{fmtMoeda(totalCartao(r))}</TableCell>
                  {verReembolsados && <TableCell className="py-2">{fmtData(r.cartao_reembolsado_em)}</TableCell>}
                  {verReembolsados && (
                    <TableCell className="py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDesfazer(r)} title="Desfazer reembolso"><Undo2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {lista.length === 0 && (
                <TableRow><TableCell colSpan={verReembolsados ? 14 : 12} className="text-center text-muted-foreground py-6">Nenhum reembolso {verReembolsados ? "reembolsado" : "pendente"}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar {selecionados.size} como reembolsado(s) no cartão</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label>Data do reembolso no cartão</Label>
              <Input type="date" value={dataReemb} onChange={(e) => setDataReemb(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={salvando}>{salvando ? "Salvando..." : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDesfazer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDesfazer(null)}>
          <Card className="max-w-sm p-4 m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">Desfazer reembolso do cartão?</h3>
            <p className="text-sm text-muted-foreground mb-4">O reembolso <b className="font-mono">{confirmDesfazer.reembolso_id || ""}</b> voltará para <b>Pendentes</b>.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDesfazer(null)}>Cancelar</Button>
              <Button onClick={() => handleDesfazer(confirmDesfazer)} disabled={desfazer.isPending}>{desfazer.isPending ? "..." : "Desfazer"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
