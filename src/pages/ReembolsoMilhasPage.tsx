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
import { Plane, CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";

const fmtMilhas = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const fmtData = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const fmtDataHora = (s?: string | null) =>
  s ? `${new Date(s).toLocaleDateString("pt-BR")} ${new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—";

export default function ReembolsoMilhasPage() {
  const { data: reembolsos, isLoading } = useReembolsos();
  const marcar = useMarcarReembolsoStatus();
  const desfazer = useDesfazerReembolsoStatus();

  const [verReembolsados, setVerReembolsados] = useState(false);
  const [fPrograma, setFPrograma] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dataReemb, setDataReemb] = useState(new Date().toISOString().split("T")[0]);
  const [salvando, setSalvando] = useState(false);
  const [confirmDesfazer, setConfirmDesfazer] = useState<any>(null);

  const comMilhas = useMemo(() => (reembolsos ?? []).filter((r) => (Number(r.dt_milhas) || 0) > 0), [reembolsos]);

  // Totais por programa dentro da aba atual (pendentes ou reembolsados).
  const doTab = useMemo(() => comMilhas.filter((r) => !!r.milhas_reembolsadas === verReembolsados), [comMilhas, verReembolsados]);
  const porPrograma = useMemo(() => {
    const map: Record<string, number> = {};
    doTab.forEach((r) => { const p = r.programa || "—"; map[p] = (map[p] || 0) + (Number(r.dt_milhas) || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [doTab]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return doTab
      .filter((r) => (fPrograma ? (r.programa || "—") === fPrograma : true))
      .filter((r) => {
        if (!q) return true;
        return [r.reembolso_id, r.localizador, r.id_emissao, r.programa, r.conta].some((v) => String(v ?? "").toLowerCase().includes(q));
      });
  }, [doTab, fPrograma, busca]);

  const clienteLabel = (r: any) => (r.clientes ? `${r.clientes.codigo} - ${r.clientes.nome_fantasia}` : "—");

  const toggle = (id: string) => setSelecionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTodos = () => { if (selecionados.size === lista.length) setSelecionados(new Set()); else setSelecionados(new Set(lista.map((r) => r.id))); };

  const abrir = () => { if (selecionados.size === 0) { toast.error("Selecione ao menos um."); return; } setDataReemb(new Date().toISOString().split("T")[0]); setDialogOpen(true); };
  const confirmar = async () => {
    setSalvando(true);
    try {
      await marcar.mutateAsync({ ids: Array.from(selecionados), campo: "milhas_reembolsadas", dataField: "milhas_reembolsadas_em", data: dataReemb });
      toast.success("Milhas marcadas como devolvidas.");
      setSelecionados(new Set());
      setDialogOpen(false);
    } catch (e: any) { toast.error(e?.message || "Erro ao marcar."); } finally { setSalvando(false); }
  };
  const handleDesfazer = async (r: any) => {
    try {
      await desfazer.mutateAsync({ id: r.id, campo: "milhas_reembolsadas", dataField: "milhas_reembolsadas_em" });
      toast.success("Devolução de milhas desfeita — voltou para Pendentes.");
      setConfirmDesfazer(null);
    } catch (e: any) { toast.error(e?.message || "Erro ao desfazer."); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Plane className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Reembolso Milhas</h1>
          <AjudaButton chave="reembolso_milhas" />
        </div>
        {!verReembolsados && selecionados.size > 0 && (
          <Button onClick={abrir}><CheckCircle2 className="h-4 w-4 mr-2" />Marcar como devolvido ({selecionados.size})</Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Milhas que voltam ao estoque (Qtde Milhas do lado Dream Tickets), por programa. Clique num programa para filtrar.
      </p>

      {/* Totais por programa (da aba atual) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {porPrograma.map(([prog, milhas]) => (
          <Card key={prog} onClick={() => setFPrograma(fPrograma === prog ? "" : prog)}
            className={`p-3 cursor-pointer transition-colors ${fPrograma === prog ? "ring-2 ring-primary" : "hover:bg-muted/40"}`}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{prog}</p>
            <p className="text-xl font-bold">{fmtMilhas(milhas)}</p>
            <p className="text-[11px] text-muted-foreground">{verReembolsados ? "milhas devolvidas" : "milhas a devolver"}</p>
          </Card>
        ))}
        {porPrograma.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma milha {verReembolsados ? "devolvida" : "a devolver"}.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por ID, localizador, emissão ou programa..." />
        <div className="inline-flex rounded-md border overflow-hidden text-sm">
          <button type="button" onClick={() => { setVerReembolsados(false); setSelecionados(new Set()); }}
            className={`px-3 py-2 ${!verReembolsados ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}>Pendentes</button>
          <button type="button" onClick={() => { setVerReembolsados(true); setSelecionados(new Set()); }}
            className={`px-3 py-2 ${verReembolsados ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}>Reembolsados</button>
        </div>
        {fPrograma && <button type="button" onClick={() => setFPrograma("")} className="text-xs text-primary underline">Limpar filtro ({fPrograma})</button>}
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
                <TableHead>Programa</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Milhas</TableHead>
                {verReembolsados && <TableHead>Devolvido em</TableHead>}
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
                  <TableCell className="py-2">{r.programa || "—"}</TableCell>
                  <TableCell className="py-2 font-mono text-sm">{r.conta || "—"}</TableCell>
                  <TableCell className="py-2 text-sm">{clienteLabel(r)}</TableCell>
                  <TableCell className="py-2 text-right font-mono whitespace-nowrap">{fmtMilhas(r.dt_milhas)}</TableCell>
                  {verReembolsados && <TableCell className="py-2">{fmtData(r.milhas_reembolsadas_em)}</TableCell>}
                  {verReembolsados && (
                    <TableCell className="py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDesfazer(r)} title="Desfazer devolução"><Undo2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {lista.length === 0 && (
                <TableRow><TableCell colSpan={verReembolsados ? 11 : 9} className="text-center text-muted-foreground py-6">Nenhuma milha {verReembolsados ? "devolvida" : "a devolver"}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar {selecionados.size} como devolvido(s) ao estoque</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label>Data da devolução</Label>
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
            <h3 className="font-semibold mb-1">Desfazer devolução de milhas?</h3>
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
